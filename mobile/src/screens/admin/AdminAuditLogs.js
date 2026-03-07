import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, Modal, ScrollView, TextInput, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../../styles/theme';
import { supabase } from '../../lib/supabase';

// Helper for action-based styling and iconography
const getActionConfig = (action) => {
    const act = action.toLowerCase();
    if (act.includes('create') || act.includes('add')) return { icon: 'add-circle', color: '#10B981', bg: '#F0FDF4', label: 'Create' };
    if (act.includes('update') || act.includes('edit')) return { icon: 'sync-circle', color: '#3B82F6', bg: '#EFF6FF', label: 'Update' };
    if (act.includes('delete') || act.includes('remove')) return { icon: 'trash-outline', color: '#EF4444', bg: '#FEF2F2', label: 'Delete' };
    if (act.includes('login') || act.includes('auth')) return { icon: 'shield-checkmark', color: '#8B5CF6', bg: '#F5F3FF', label: 'Security' };
    if (act.includes('wallet') || act.includes('payment') || act.includes('revenue')) return { icon: 'cash-outline', color: '#F59E0B', bg: '#FFFBEB', label: 'Financial' };
    if (act.includes('order')) return { icon: 'cart-outline', color: '#6366F1', bg: '#EEF2FF', label: 'Order' };
    return { icon: 'information-circle-outline', color: '#64748B', bg: '#F8FAFC', label: 'General' };
};

export const AdminAuditLogs = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLog, setSelectedLog] = useState(null);
    const [stats, setStats] = useState({ total: 0, today: 0, security: 0 });

    useEffect(() => {
        fetchLogs();
        const subscription = subscribeToLogs();
        return () => {
            if (subscription) supabase.removeChannel(subscription);
        };
    }, [filter]);

    const fetchLogs = async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        try {
            let query = supabase.from('audit_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (filter !== 'all') {
                if (filter === 'security') query = query.ilike('action', '%login%');
                else if (filter === 'financial') query = query.or('action.ilike.%wallet%,action.ilike.%payment%');
                else query = query.ilike('action', `%${filter}%`);
            }

            const { data, error } = await query;
            if (error) throw error;

            if (data && data.length > 0) {
                const userIds = [...new Set(data.filter(l => l.user_id).map(l => l.user_id))];
                let profileMap = {};

                if (userIds.length > 0) {
                    const { data: profileData } = await supabase
                        .from('profiles')
                        .select('id, full_name, email')
                        .in('id', userIds);

                    profileMap = (profileData || []).reduce((acc, p) => {
                        acc[p.id] = p;
                        return acc;
                    }, {});
                }

                const logsWithProfiles = data.map(log => ({
                    ...log,
                    user: profileMap[log.user_id] || null
                }));

                setLogs(logsWithProfiles);
                calculateStats(logsWithProfiles);
            } else {
                setLogs([]);
                calculateStats([]);
            }
        } catch (err) {
            console.error('Audit Fetch Error:', err);
            setLogs([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const subscribeToLogs = () => {
        return supabase
            .channel('audit-logs-realtime')
            .on('postgres_changes', { event: 'INSERT', table: 'audit_logs' }, async (payload) => {
                let userData = null;
                if (payload.new.user_id) {
                    const { data } = await supabase
                        .from('profiles')
                        .select('full_name, email')
                        .eq('id', payload.new.user_id)
                        .single();
                    userData = data;
                }

                const newLog = { ...payload.new, user: userData };
                setLogs(prev => [newLog, ...prev.slice(0, 99)]);
            })
            .subscribe();
    };

    const calculateStats = (data) => {
        const today = new Date().toISOString().split('T')[0];
        const todayCount = data.filter(l => l.created_at.startsWith(today)).length;
        const securityCount = data.filter(l => l.action.toLowerCase().includes('login')).length;
        setStats({
            total: data.length, // Simplified for the limited fetch
            today: todayCount,
            security: securityCount
        });
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchLogs(true);
    }, [filter]);

    const filteredLogsList = logs.filter(log => {
        const matchesSearch =
            log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (log.user?.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (log.details ? JSON.stringify(log.details).toLowerCase().includes(searchQuery.toLowerCase()) : false);
        return matchesSearch;
    });

    const renderLogItem = ({ item }) => {
        const config = getActionConfig(item.action);
        const date = new Date(item.created_at);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

        return (
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setSelectedLog(item)}
                style={{
                    backgroundColor: 'white',
                    marginHorizontal: 16,
                    marginBottom: 12,
                    borderRadius: 16,
                    padding: 16,
                    flexDirection: 'row',
                    gap: 12,
                    borderWidth: 1,
                    borderColor: '#F1F5F9',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                    elevation: 1
                }}
            >
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: config.bg, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={config.icon} size={22} color={config.color} />
                </View>

                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            {item.action.replace(/_/g, ' ')}
                        </Text>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#94A3B8' }}>{timeStr}</Text>
                    </View>

                    <Text style={{ fontSize: 13, color: '#475569', marginBottom: 4 }}>
                        <Text style={{ fontWeight: '700', color: '#1E293B' }}>{item.user?.full_name || 'System'}</Text>
                        {item.details_summary ? ` • ${item.details_summary}` : item.details ? ` modified ${Object.keys(item.details).length} fields` : ''}
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9' }}>
                            <Text style={{ fontSize: 9, fontWeight: '700', color: '#64748B' }}>{config.label}</Text>
                        </View>
                        <Text style={{ fontSize: 10, color: '#94A3B8' }}>{dateStr}</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            {/* Header Section */}
            <View style={{ backgroundColor: 'white', paddingBottom: 16, borderBottomWidth: 1, borderColor: '#F1F5F9' }}>
                <View style={{ paddingHorizontal: 20, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                        <Text style={{ fontSize: 22, fontWeight: '900', color: '#0F172A' }}>Audit Center</Text>
                        <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '500' }}>Platform activity monitoring</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <View style={{ alignItems: 'center', backgroundColor: '#F0FDF4', padding: 8, borderRadius: 12, minWidth: 60 }}>
                            <Text style={{ fontSize: 14, fontWeight: '900', color: '#10B981' }}>{stats.today}</Text>
                            <Text style={{ fontSize: 8, fontWeight: '700', color: '#059669', textTransform: 'uppercase' }}>Today</Text>
                        </View>
                        <View style={{ alignItems: 'center', backgroundColor: '#F5F3FF', padding: 8, borderRadius: 12, minWidth: 60 }}>
                            <Text style={{ fontSize: 14, fontWeight: '900', color: '#8B5CF6' }}>{stats.security}</Text>
                            <Text style={{ fontSize: 8, fontWeight: '700', color: '#7C3AED', textTransform: 'uppercase' }}>Security</Text>
                        </View>
                    </View>
                </View>

                {/* Search Bar */}
                <View style={{ marginHorizontal: 20, marginTop: 16, backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' }}>
                    <Ionicons name="search" size={18} color="#94A3B8" />
                    <TextInput
                        placeholder="Search logs, actors, or data..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        style={{ flex: 1, marginLeft: 10, fontSize: 14, color: '#1E293B', fontWeight: '600' }}
                    />
                </View>

                {/* Filter Chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, gap: 8 }}>
                    {[
                        { id: 'all', label: 'All activity', icon: 'list' },
                        { id: 'security', label: 'Security', icon: 'shield-checkmark' },
                        { id: 'order', label: 'Orders', icon: 'cart' },
                        { id: 'financial', label: 'Financial', icon: 'cash' },
                        { id: 'product', label: 'Inventory', icon: 'cube' },
                        { id: 'update', label: 'Updates', icon: 'sync' }
                    ].map(f => (
                        <TouchableOpacity
                            key={f.id}
                            onPress={() => setFilter(f.id)}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                paddingHorizontal: 14,
                                paddingVertical: 8,
                                borderRadius: 20,
                                backgroundColor: filter === f.id ? '#0F172A' : '#F1F5F9',
                                borderWidth: 1,
                                borderColor: filter === f.id ? '#0F172A' : '#E2E8F0'
                            }}
                        >
                            <Ionicons name={f.icon} size={14} color={filter === f.id ? 'white' : '#64748B'} />
                            <Text style={{ fontSize: 12, color: filter === f.id ? 'white' : '#64748B', fontWeight: '700' }}>{f.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#0F172A" />
                    <Text style={{ marginTop: 12, color: '#64748B', fontWeight: '600' }}>Syncing logs...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredLogsList}
                    renderItem={renderLogItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ paddingTop: 20, paddingBottom: 40 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0F172A']} />}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', marginTop: 60, paddingHorizontal: 40 }}>
                            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                                <Ionicons name="search-outline" size={32} color="#94A3B8" />
                            </View>
                            <Text style={{ fontSize: 16, fontWeight: '800', color: '#334155', textAlign: 'center' }}>No matches found</Text>
                            <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 4 }}>Try adjusting your filters or search terms to find what you're looking for.</Text>
                        </View>
                    }
                />
            )}

            {/* Detail Modal */}
            <Modal
                visible={!!selectedLog}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setSelectedLog(null)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: 'white', borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '80%', padding: 24 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={{ fontSize: 20, fontWeight: '900', color: '#0F172A' }}>Log Details</Text>
                            <TouchableOpacity onPress={() => setSelectedLog(null)} style={{ padding: 4 }}>
                                <Ionicons name="close" size={28} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        {selectedLog && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={{ padding: 20, backgroundColor: '#F8FAFC', borderRadius: 20, marginBottom: 20, borderWidth: 1, borderColor: '#F1F5F9' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                                        <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: getActionConfig(selectedLog.action).bg, alignItems: 'center', justifyContent: 'center' }}>
                                            <Ionicons name={getActionConfig(selectedLog.action).icon} size={24} color={getActionConfig(selectedLog.action).color} />
                                        </View>
                                        <View>
                                            <Text style={{ fontSize: 16, fontWeight: '900', color: '#0F172A', textTransform: 'uppercase' }}>{selectedLog.action.replace(/_/g, ' ')}</Text>
                                            <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600' }}>{new Date(selectedLog.created_at).toLocaleString()}</Text>
                                        </View>
                                    </View>

                                    <View style={{ gap: 12 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={{ color: '#64748B', fontWeight: '600', fontSize: 13 }}>Primary Actor</Text>
                                            <Text style={{ color: '#0F172A', fontWeight: '800', fontSize: 13 }}>{selectedLog.user?.full_name || 'System'}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={{ color: '#64748B', fontWeight: '600', fontSize: 13 }}>Actor ID</Text>
                                            <Text style={{ color: '#64748B', fontWeight: '500', fontSize: 11 }}>{selectedLog.user_id}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={{ color: '#64748B', fontWeight: '600', fontSize: 13 }}>Email</Text>
                                            <Text style={{ color: '#0F172A', fontWeight: '600', fontSize: 13 }}>{selectedLog.user?.email || 'N/A'}</Text>
                                        </View>
                                    </View>
                                </View>

                                <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 12, marginLeft: 4 }}>Structured Data</Text>
                                <View style={{ backgroundColor: '#1E293B', borderRadius: 20, padding: 20 }}>
                                    <Text style={{ color: '#38BDF8', fontFamily: 'monospace', fontSize: 12 }}>
                                        {JSON.stringify(selectedLog.details || {}, null, 2)}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={{ marginTop: 30, backgroundColor: '#0F172A', padding: 18, borderRadius: 16, alignItems: 'center' }}
                                    onPress={() => setSelectedLog(null)}
                                >
                                    <Text style={{ color: 'white', fontWeight: '900', fontSize: 16 }}>Close Inspector</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
};
