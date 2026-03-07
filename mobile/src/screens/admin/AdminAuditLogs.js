import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, Modal, ScrollView, TextInput, RefreshControl, Share, Animated, Easing, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../../styles/theme';
import { supabase } from '../../lib/supabase';
import * as Clipboard from 'expo-clipboard';

// High-Performance Forensic CSV Utility (Zero Dependency)
const forensicJSONtoCSV = (data) => {
    if (!data.length) return '';
    const headers = Object.keys(data[0]);
    const lines = [headers.join(',')];

    data.forEach(item => {
        const row = headers.map(header => {
            let cell = item[header] === null || item[header] === undefined ? '' : String(item[header]);
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

    if (act.includes('payout') || act.includes('approve_vendor')) config.impact = 'high';

    return config;
};

export const AdminAuditLogs = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState('all');
    const [timeRange, setTimeRange] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLog, setSelectedLog] = useState(null);
    const [stats, setStats] = useState({ total: 0, today: 0, security: 0, highImpact: 0, velocity: 0, peakHour: 'N/A' });
    const [exporting, setExporting] = useState(false);
    const [isLive, setIsLive] = useState(true);
    const [discoveryPreset, setDiscoveryPreset] = useState(null);

    // Pulse Animation for Live Status
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (isLive) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 0.4, duration: 1000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) })
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [isLive]);

    useEffect(() => {
        fetchLogs();
        const subscription = subscribeToLogs();
        return () => {
            if (subscription) supabase.removeChannel(subscription);
        };
    }, [filter, timeRange, discoveryPreset]);

    const fetchLogs = async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        try {
            let query = supabase.from('audit_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(200);

            // Forensic Discovery Presets
            if (discoveryPreset === 'security') {
                query = query.or('action.ilike.%login%,action.ilike.%auth%,action.ilike.%password%,action.ilike.%permission%');
            } else if (discoveryPreset === 'finance') {
                query = query.or('action.ilike.%wallet%,action.ilike.%payment%,action.ilike.%payout%,action.ilike.%revenue%');
            } else if (discoveryPreset === 'infra') {
                query = query.or('action.ilike.%vendor_approval%,action.ilike.%config%,action.ilike.%status%');
            }

            // Time Range Calculation
            if (!discoveryPreset && timeRange !== 'all') {
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

            if (!discoveryPreset && filter !== 'all') {
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
            .channel('audit-logs-platinum-v3')
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
                setLogs(prev => {
                    const updated = [newLog, ...prev.slice(0, 199)];
                    calculateStats(updated);
                    return updated;
                });
            })
            .on('system', { event: '*' }, (e) => {
                if (e.event === 'closed') setIsLive(false);
            })
            .subscribe();
    };

    const calculateStats = (data) => {
        const now = new Date();
        const hourAgo = new Date(now.getTime() - 3600000).toISOString();
        const today = now.toISOString().split('T')[0];

        const todayCount = data.filter(l => l.created_at.startsWith(today)).length;
        const securityCount = data.filter(l => l.action.toLowerCase().includes('login')).length;
        const highImpactCount = data.filter(l => l.config.impact === 'high').length;
        const velocity = data.filter(l => l.created_at >= hourAgo).length;

        // Peak Hour Calculation
        const hourBins = data.reduce((acc, l) => {
            const hour = new Date(l.created_at).getHours();
            acc[hour] = (acc[hour] || 0) + 1;
            return acc;
        }, {});

        let peak = 'N/A';
        let max = 0;
        Object.entries(hourBins).forEach(([h, count]) => {
            if (count > max) {
                max = count;
                peak = `${h}:00`;
            }
        });

        setStats({
            total: data.length,
            today: todayCount,
            security: securityCount,
            highImpact: highImpactCount,
            velocity,
            peakHour: peak
        });
    };

    const copyToClipboard = async (text) => {
        await Clipboard.setStringAsync(text);
        Alert.alert('Forensics Copied', 'The structured data has been saved to your clipboard.');
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
                Impact: (l.config.impact || 'LOW').toUpperCase()
            }));

            const csvString = forensicJSONtoCSV(csvData);
            await Share.share({ message: csvString, title: 'Platinum_Audit_Forensics' });
        } catch (err) {
            console.error('Export Error:', err);
        } finally {
            setExporting(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchLogs(true);
    }, [filter, timeRange, discoveryPreset]);

    const filteredLogsList = logs.filter(log => {
        const matchesSearch =
            log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (log.user?.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (log.details ? JSON.stringify(log.details).toLowerCase().includes(searchQuery.toLowerCase()) : false);
        return matchesSearch;
    });

    const renderLogItem = ({ item, index }) => {
        const date = new Date(item.created_at);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Session Intelligence: Detect Burst (same user within 5 mins of next item)
        const nextItem = logs[index + 1];
        let isBurst = false;
        if (nextItem && nextItem.user_id === item.user_id) {
            const diff = Math.abs(new Date(item.created_at) - new Date(nextItem.created_at));
            if (diff < 300000) isBurst = true; // 5 mins
        }

        return (
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setSelectedLog(item)}
                style={{
                    backgroundColor: 'white',
                    marginHorizontal: 16,
                    marginBottom: isBurst ? 2 : 12,
                    borderRadius: isBurst ? 4 : 20,
                    padding: 16,
                    flexDirection: 'row',
                    gap: 12,
                    borderWidth: 1,
                    borderColor: '#F1F5F9',
                    elevation: isBurst ? 0 : 1
                }}
            >
                {/* Significance Indicator */}
                <View style={{
                    position: 'absolute',
                    left: 0, top: 0, bottom: 0, width: 4,
                    backgroundColor: item.config.impact === 'high' ? '#EF4444' : item.config.impact === 'medium' ? '#F59E0B' : '#E2E8F0'
                }} />

                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: item.config.bg, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={item.config.icon} size={22} color={item.config.color} />
                </View>

                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>
                            {item.action.replace(/_/g, ' ')}
                        </Text>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#94A3B8' }}>{timeStr}</Text>
                    </View>

                    <Text style={{ fontSize: 13, color: '#475569', marginBottom: 6 }} numberOfLines={1}>
                        <Text style={{ fontWeight: '800', color: '#1E293B' }}>{item.user?.full_name || 'System'}</Text>
                        {item.details_summary ? ` • ${item.details_summary}` : ''}
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9' }}>
                            <Text style={{ fontSize: 8, fontWeight: '800', color: '#64748B' }}>{item.config.label}</Text>
                        </View>
                        {isBurst && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                <Ionicons name="flash" size={10} color="#6366F1" />
                                <Text style={{ fontSize: 8, fontWeight: '900', color: '#6366F1' }}>SESSION BURST</Text>
                            </View>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            {/* Elite Header */}
            <View style={{ backgroundColor: 'white', paddingBottom: 16, borderBottomWidth: 1, borderColor: '#F1F5F9' }}>
                <View style={{ paddingHorizontal: 20, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={{ fontSize: 24, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 }}>Platinum Audit</Text>
                            <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isLive ? '#10B981' : '#CBD5E1', opacity: pulseAnim }} />
                        </View>
                        <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '700' }}>{isLive ? 'LIVE SYNC ACTIVE' : 'RECONNECTING...'}</Text>
                    </View>
                    <TouchableOpacity onPress={exportToCSV} disabled={exporting} style={{ padding: 12, backgroundColor: '#0F172A', borderRadius: 14 }}>
                        {exporting ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="cloud-download" size={20} color="white" />}
                    </TouchableOpacity>
                </View>

                {/* Discovery & Search */}
                <View style={{ marginHorizontal: 20, marginTop: 16, flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1, backgroundColor: '#F8FAFC', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' }}>
                        <Ionicons name="search" size={18} color="#94A3B8" />
                        <TextInput placeholder="Forensic Discovery..." value={searchQuery} onChangeText={setSearchQuery} style={{ flex: 1, marginLeft: 10, fontSize: 14, fontWeight: '700', color: '#1E293B' }} />
                    </View>
                </View>

                {/* Platinum Forensic Presets */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, gap: 10 }}>
                    <View style={{ flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 20, padding: 2 }}>
                        {[
                            { id: null, label: 'Default' }, { id: 'security', label: 'Security' }, { id: 'finance', label: 'Finance' }, { id: 'infra', label: 'Infra' }
                        ].map(p => (
                            <TouchableOpacity key={p.id} onPress={() => setDiscoveryPreset(p.id)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18, backgroundColor: discoveryPreset === p.id ? 'white' : 'transparent', elevation: discoveryPreset === p.id ? 2 : 0 }}>
                                <Text style={{ fontSize: 10, color: discoveryPreset === p.id ? '#0F172A' : '#64748B', fontWeight: '800' }}>{p.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {!discoveryPreset && [
                        { id: 'all', label: 'All Time' }, { id: 'hour', label: '1h Velocity' }, { id: 'today', label: 'Today' }
                    ].map(t => (
                        <TouchableOpacity key={t.id} onPress={() => setTimeRange(t.id)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderBottomWidth: timeRange === t.id ? 2 : 0, borderBottomColor: '#0F172A' }}>
                            <Text style={{ fontSize: 11, color: '#0F172A', fontWeight: '800' }}>{t.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Intensity Metrics HUD */}
            <View style={{ flexDirection: 'row', padding: 20, gap: 12 }}>
                <View style={{ flex: 1, backgroundColor: 'white', borderRadius: 24, padding: 18, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOpacity: 0.05, elevation: 2 }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#94A3B8' }}>VELOCITY (1H)</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <Ionicons name="trending-up" size={16} color="#10B981" />
                        <Text style={{ fontSize: 22, fontWeight: '900', color: '#0F172A' }}>{stats.velocity}</Text>
                    </View>
                </View>
                <View style={{ flex: 1, backgroundColor: 'white', borderRadius: 24, padding: 18, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOpacity: 0.05, elevation: 2 }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#94A3B8' }}>PEAK ACTIVITY</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <Ionicons name="time" size={16} color="#6366F1" />
                        <Text style={{ fontSize: 20, fontWeight: '900', color: '#0F172A' }}>{stats.peakHour}</Text>
                    </View>
                </View>
            </View>

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#0F172A" />
                </View>
            ) : (
                <FlatList
                    data={filteredLogsList}
                    renderItem={renderLogItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ paddingBottom: 40 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0F172A']} />}
                />
            )}

            {/* Forensic Intelligence Modal */}
            <Modal visible={!!selectedLog} transparent animationType="slide">
                <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: 'white', borderTopLeftRadius: 40, borderTopRightRadius: 40, height: '88%', padding: 24 }}>
                        <View style={{ backgroundColor: '#E2E8F0', width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 20 }} />

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <View>
                                <Text style={{ fontSize: 22, fontWeight: '900', color: '#0F172A' }}>Forensic Case</Text>
                                <Text style={{ fontSize: 12, color: '#94A3B8', fontWeight: '700' }}>ID: {selectedLog?.id.slice(0, 10)}...</Text>
                            </View>
                            <TouchableOpacity onPress={() => setSelectedLog(null)} style={{ padding: 8, backgroundColor: '#F8FAFC', borderRadius: 20 }}>
                                <Ionicons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        {selectedLog && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={{ padding: 24, backgroundColor: '#0F172A', borderRadius: 32, marginBottom: 24 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                                        <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                                            <Ionicons name="finger-print" size={32} color="white" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 18, fontWeight: '900', color: 'white' }}>{selectedLog.user?.full_name || 'System Identity'}</Text>
                                            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '700' }}>{selectedLog.user?.email || 'automated-task@platform'}</Text>
                                        </View>
                                    </View>
                                </View>

                                <View style={{ backgroundColor: '#F8FAFC', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 24 }}>
                                    <Text style={{ fontSize: 10, fontWeight: '900', color: '#94A3B8', marginBottom: 8 }}>PLATFORM IMPACT</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                        <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: selectedLog.config.bg }}>
                                            <Text style={{ fontSize: 12, fontWeight: '900', color: selectedLog.config.color }}>{selectedLog.config.label.toUpperCase()}</Text>
                                        </View>
                                        <Text style={{ fontSize: 14, fontWeight: '800', color: '#1E293B' }}>{selectedLog.action.replace(/_/g, ' ')}</Text>
                                    </View>
                                </View>

                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <Text style={{ fontSize: 16, fontWeight: '900', color: '#0F172A' }}>Data Laboratory</Text>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <TouchableOpacity onPress={() => copyToClipboard(JSON.stringify(selectedLog.details, null, 2))} style={{ padding: 10, backgroundColor: '#F1F5F9', borderRadius: 12 }}>
                                            <Ionicons name="copy-outline" size={18} color="#64748B" />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => Share.share({ message: `Audit Forensic Data:\nAction: ${selectedLog.action}\nMeta: ${JSON.stringify(selectedLog.details)}` })} style={{ padding: 10, backgroundColor: '#F1F5F9', borderRadius: 12 }}>
                                            <Ionicons name="share-outline" size={18} color="#64748B" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View style={{ backgroundColor: '#1E293B', borderRadius: 28, padding: 24, marginBottom: 40 }}>
                                    <Text style={{ color: '#38BDF8', fontFamily: 'monospace', fontSize: 12, lineHeight: 20 }}>
                                        {JSON.stringify(selectedLog.details || { forensic: "No metadata found" }, null, 2)}
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
