import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, Modal, ScrollView, TextInput, RefreshControl, Share, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../../styles/theme';
import { supabase } from '../../lib/supabase';

// High-Performance Forensic CSV Utility (Zero Dependency)
const forensicJSONtoCSV = (data) => {
    if (!data.length) return '';
    const headers = Object.keys(data[0]);
    const lines = [headers.join(',')];

    data.forEach(item => {
        const row = headers.map(header => {
            let cell = item[header] === null || item[header] === undefined ? '' : String(item[header]);
            // Escape double quotes and wrap in quotes if contains comma or newline
            cell = cell.replace(/"/g, '""');
            if (cell.includes(',') || cell.includes('\n') || cell.includes('"')) {
                cell = `"${cell}"`;
            }
            return cell;
        });
        lines.push(row.join(','));
    });
    return lines.join('\n');
};

// Professional Action Configuration with Significance
const getActionConfig = (action) => {
    const act = action.toLowerCase();
    const config = { icon: 'information-circle-outline', color: '#64748B', bg: '#F8FAFC', label: 'General', impact: 'low' };

    if (act.includes('create') || act.includes('add')) {
        config.icon = 'add-circle'; config.color = '#10B981'; config.bg = '#F0FDF4'; config.label = 'Create'; config.impact = 'medium';
    } else if (act.includes('update') || act.includes('edit')) {
        config.icon = 'sync-circle'; config.color = '#3B82F6'; config.bg = '#EFF6FF'; config.label = 'Update'; config.impact = 'low';
    } else if (act.includes('delete') || act.includes('remove')) {
        config.icon = 'trash-outline'; config.color = '#EF4444'; config.bg = '#FEF2F2'; config.label = 'Delete'; config.impact = 'high';
    } else if (act.includes('login') || act.includes('auth')) {
        config.icon = 'shield-checkmark'; config.color = '#8B5CF6'; config.bg = '#F5F3FF'; config.label = 'Security'; config.impact = 'medium';
    } else if (act.includes('wallet') || act.includes('payment') || act.includes('revenue')) {
        config.icon = 'cash-outline'; config.color = '#F59E0B'; config.bg = '#FFFBEB'; config.label = 'Financial'; config.impact = 'medium';
    } else if (act.includes('order')) {
        config.icon = 'cart-outline'; config.color = '#6366F1'; config.bg = '#EEF2FF'; config.label = 'Order'; config.impact = 'low';
    }

    // Overrides for specific high-impact actions
    if (act.includes('payout') || act.includes('approve_vendor')) config.impact = 'high';

    return config;
};

export const AdminAuditLogs = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState('all');
    const [timeRange, setTimeRange] = useState('all'); // 'hour', 'today', 'yesterday', 'week', 'all'
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLog, setSelectedLog] = useState(null);
    const [stats, setStats] = useState({ total: 0, today: 0, security: 0, highImpact: 0 });
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        fetchLogs();
        const subscription = subscribeToLogs();
        return () => {
            if (subscription) supabase.removeChannel(subscription);
        };
    }, [filter, timeRange]);

    const fetchLogs = async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        try {
            let query = supabase.from('audit_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(150);

            // Time Range Calculation
            if (timeRange !== 'all') {
                const now = new Date();
                let startDate;
                if (timeRange === 'hour') startDate = new Date(now.getTime() - 3600000);
                else if (timeRange === 'today') startDate = new Date(now.setHours(0, 0, 0, 0));
                else if (timeRange === 'yesterday') {
                    const yesterday = new Date(now);
                    yesterday.setDate(now.getDate() - 1);
                    startDate = new Date(yesterday.setHours(0, 0, 0, 0));
                    const endOfYesterday = new Date(yesterday.setHours(23, 59, 59, 999));
                    query = query.lt('created_at', endOfYesterday.toISOString());
                }
                else if (timeRange === 'week') {
                    startDate = new Date(now);
                    startDate.setDate(now.getDate() - 7);
                }

                if (startDate) query = query.gte('created_at', startDate.toISOString());
            }

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
                    user: profileMap[log.user_id] || null,
                    config: getActionConfig(log.action)
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
            .channel('audit-logs-realtime-v2')
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

                const newLog = { ...payload.new, user: userData, config: getActionConfig(payload.new.action) };
                setLogs(prev => [newLog, ...prev.slice(0, 149)]);
                setStats(prev => ({ ...prev, total: prev.total + 1, today: prev.today + 1 }));
            })
            .subscribe();
    };

    const calculateStats = (data) => {
        const today = new Date().toISOString().split('T')[0];
        const todayCount = data.filter(l => l.created_at.startsWith(today)).length;
        const securityCount = data.filter(l => l.action.toLowerCase().includes('login')).length;
        const highImpactCount = data.filter(l => l.config.impact === 'high').length;

        setStats({
            total: data.length,
            today: todayCount,
            security: securityCount,
            highImpact: highImpactCount
        });
    };

    const exportToCSV = async () => {
        setExporting(true);
        try {
            const csvData = filteredLogsList.map(l => ({
                ID: l.id,
                Timestamp: new Date(l.created_at).toLocaleString(),
                Action: l.action,
                Actor: l.user?.full_name || 'System',
                ActorEmail: l.user?.email || 'N/A',
                Details: l.details ? JSON.stringify(l.details) : 'N/A',
                Significance: (l.config.impact || 'LOW').toUpperCase()
            }));

            const csvString = forensicJSONtoCSV(csvData);
            await Share.share({
                message: csvString,
                title: 'Audit_Logs_Forensics'
            });
        } catch (err) {
            console.error('Export Error:', err);
        } finally {
            setExporting(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchLogs(true);
    }, [filter, timeRange]);

    const filteredLogsList = logs.filter(log => {
        const matchesSearch =
            log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (log.user?.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (log.details ? JSON.stringify(log.details).toLowerCase().includes(searchQuery.toLowerCase()) : false);
        return matchesSearch;
    });

    const renderLogItem = ({ item }) => {
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
                    marginBottom: 10,
                    borderRadius: 20,
                    padding: 16,
                    flexDirection: 'row',
                    gap: 12,
                    borderWidth: 1,
                    borderColor: '#F1F5F9',
                    elevation: 1,
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                {/* Impact Indicator Bar */}
                <View style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 4,
                    backgroundColor: item.config.impact === 'high' ? '#EF4444' : item.config.impact === 'medium' ? '#F59E0B' : '#E2E8F0'
                }} />

                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: item.config.bg, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={item.config.icon} size={22} color={item.config.color} />
                </View>

                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            {item.action.replace(/_/g, ' ')}
                        </Text>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#94A3B8' }}>{timeStr}</Text>
                    </View>

                    <Text style={{ fontSize: 13, color: '#475569', marginBottom: 6 }}>
                        <Text style={{ fontWeight: '700', color: '#1E293B' }}>{item.user?.full_name || 'System'}</Text>
                        {item.details_summary ? ` • ${item.details_summary}` : item.details ? ` modified ${Object.keys(item.details).length} fields` : ''}
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9' }}>
                            <Text style={{ fontSize: 9, fontWeight: '800', color: '#64748B' }}>{item.config.label}</Text>
                        </View>
                        <Text style={{ fontSize: 10, color: '#CBD5E1', fontWeight: '500' }}>{dateStr}</Text>
                        {item.config.impact === 'high' && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                <Ionicons name="alert-circle" size={10} color="#EF4444" />
                                <Text style={{ fontSize: 9, fontWeight: '800', color: '#EF4444' }}>CRITICAL</Text>
                            </View>
                        )}
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
                        <Text style={{ fontSize: 24, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 }}>Audit Center</Text>
                        <Text style={{ fontSize: 12, color: '#94A3B8', fontWeight: '600' }}>Professional platform surveillance</Text>
                    </View>
                    <TouchableOpacity
                        onPress={exportToCSV}
                        disabled={exporting}
                        style={{ padding: 10, backgroundColor: '#0F172A', borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                    >
                        {exporting ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="cloud-download" size={18} color="white" />}
                        <Text style={{ color: 'white', fontWeight: '800', fontSize: 12 }}>Export</Text>
                    </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={{ marginHorizontal: 20, marginTop: 16, backgroundColor: '#F8FAFC', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' }}>
                    <Ionicons name="search" size={20} color="#94A3B8" />
                    <TextInput
                        placeholder="Search forensic logs..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        style={{ flex: 1, marginLeft: 12, fontSize: 14, color: '#1E293B', fontWeight: '700' }}
                    />
                </View>

                {/* Professional Analysis Filters (Time + Category) */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, gap: 10 }}>
                    {/* Time Ranges */}
                    <View style={{ flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 20, padding: 2 }}>
                        {[
                            { id: 'all', label: 'All' },
                            { id: 'hour', label: '1h' },
                            { id: 'today', label: 'Today' },
                            { id: 'week', label: '7d' }
                        ].map(t => (
                            <TouchableOpacity
                                key={t.id}
                                onPress={() => setTimeRange(t.id)}
                                style={{
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                    borderRadius: 18,
                                    backgroundColor: timeRange === t.id ? 'white' : 'transparent',
                                    shadowColor: timeRange === t.id ? '#000' : 'transparent',
                                    shadowOffset: { width: 0, height: 1 },
                                    shadowOpacity: 0.1,
                                    shadowRadius: 2,
                                    elevation: timeRange === t.id ? 2 : 0
                                }}
                            >
                                <Text style={{ fontSize: 11, color: timeRange === t.id ? '#0F172A' : '#64748B', fontWeight: '800' }}>{t.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Category Filters */}
                    {[
                        { id: 'security', label: 'Security', icon: 'shield-checkmark' },
                        { id: 'financial', label: 'Financial', icon: 'cash' },
                        { id: 'product', label: 'Inventory', icon: 'cube' }
                    ].map(f => (
                        <TouchableOpacity
                            key={f.id}
                            onPress={() => setFilter(filter === f.id ? 'all' : f.id)}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                paddingHorizontal: 14,
                                paddingVertical: 8,
                                borderRadius: 20,
                                backgroundColor: filter === f.id ? '#0F172A' : 'white',
                                borderWidth: 1,
                                borderColor: filter === f.id ? '#0F172A' : '#E2E8F0'
                            }}
                        >
                            <Ionicons name={f.icon} size={14} color={filter === f.id ? 'white' : '#64748B'} />
                            <Text style={{ fontSize: 12, color: filter === f.id ? 'white' : '#64748B', fontWeight: '800' }}>{f.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Performance Stats HUD */}
            <View style={{ flexDirection: 'row', padding: 20, gap: 12 }}>
                <View style={{ flex: 1, backgroundColor: 'white', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#F1F5F9' }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase' }}>High Impact</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' }} />
                        <Text style={{ fontSize: 20, fontWeight: '900', color: '#0F172A' }}>{stats.highImpact}</Text>
                    </View>
                </View>
                <View style={{ flex: 1, backgroundColor: 'white', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#F1F5F9' }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase' }}>Filtered Results</Text>
                    <Text style={{ fontSize: 20, fontWeight: '900', color: '#0F172A', marginTop: 4 }}>{filteredLogsList.length}</Text>
                </View>
            </View>

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#0F172A" />
                    <Text style={{ marginTop: 12, color: '#64748B', fontWeight: '700' }}>Running forensic query...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredLogsList}
                    renderItem={renderLogItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ paddingBottom: 40 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0F172A']} />}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', marginTop: 60, paddingHorizontal: 40 }}>
                            <Ionicons name="search-outline" size={48} color="#CBD5E1" />
                            <Text style={{ fontSize: 16, fontWeight: '800', color: '#334155', marginTop: 16 }}>No activity found</Text>
                            <Text style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', marginTop: 4 }}>Refine your forensic filters or time range to find recorded events.</Text>
                        </View>
                    }
                />
            )}

            {/* Forensic Detail Modal */}
            <Modal
                visible={!!selectedLog}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setSelectedLog(null)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: 'white', borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '85%', padding: 24 }}>
                        <View style={{ backgroundColor: '#F1F5F9', width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <Text style={{ fontSize: 22, fontWeight: '900', color: '#0F172A' }}>Log Investigation</Text>
                            <TouchableOpacity onPress={() => setSelectedLog(null)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        {selectedLog && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                {/* Actor Intelligence Card */}
                                <View style={{ padding: 20, backgroundColor: '#0F172A', borderRadius: 24, marginBottom: 24 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                                        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                                            <Ionicons name="person" size={28} color="white" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 18, fontWeight: '800', color: 'white' }}>{selectedLog.user?.full_name || 'System Actor'}</Text>
                                            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' }}>{selectedLog.user?.email || 'automated-process@system'}</Text>
                                        </View>
                                        {selectedLog.user_id && (
                                            <TouchableOpacity
                                                onPress={() => {
                                                    setSelectedLog(null);
                                                    // This would normally navigate to UserDetails
                                                    // navigation.navigate('AdminUserDetails', { userId: selectedLog.user_id });
                                                }}
                                                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}
                                            >
                                                <Ionicons name="chevron-forward" size={20} color="white" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>

                                {/* Action Context */}
                                <View style={{ gap: 16, marginBottom: 24 }}>
                                    <View style={{ flexDirection: 'row', gap: 12 }}>
                                        <View style={{ flex: 1, backgroundColor: '#F8FAFC', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#F1F5F9' }}>
                                            <Text style={{ fontSize: 10, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>Action Type</Text>
                                            <Text style={{ fontSize: 14, fontWeight: '800', color: '#334155' }}>{selectedLog.action.replace(/_/g, ' ').toUpperCase()}</Text>
                                        </View>
                                        <View style={{ flex: 1, backgroundColor: '#F8FAFC', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#F1F5F9' }}>
                                            <Text style={{ fontSize: 10, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>Significance</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: selectedLog.config.impact === 'high' ? '#EF4444' : '#10B981' }} />
                                                <Text style={{ fontSize: 14, fontWeight: '800', color: selectedLog.config.impact === 'high' ? '#EF4444' : '#334155' }}>{(selectedLog.config.impact || 'LOW').toUpperCase()}</Text>
                                            </View>
                                        </View>
                                    </View>

                                    <View style={{ backgroundColor: '#F8FAFC', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#F1F5F9' }}>
                                        <Text style={{ fontSize: 10, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>Timestamp</Text>
                                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#334155' }}>{new Date(selectedLog.created_at).toLocaleString()}</Text>
                                    </View>
                                </View>

                                {/* Data Laboratory (JSON) */}
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <Text style={{ fontSize: 16, fontWeight: '900', color: '#0F172A' }}>Data Laboratory</Text>
                                    <TouchableOpacity
                                        onPress={() => Share.share({ message: JSON.stringify(selectedLog.details, null, 2) })}
                                        style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: '#F1F5F9' }}
                                    >
                                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748B' }}>Copy Data</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={{ backgroundColor: '#1E293B', borderRadius: 24, padding: 20, marginBottom: 40 }}>
                                    <Text style={{ color: '#38BDF8', fontFamily: 'monospace', fontSize: 12, lineHeight: 18 }}>
                                        {JSON.stringify(selectedLog.details || { message: "No metadata captured" }, null, 2)}
                                    </Text>
                                </View>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
};
