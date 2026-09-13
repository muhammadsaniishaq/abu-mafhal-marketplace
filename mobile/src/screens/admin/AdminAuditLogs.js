import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
    View, Text, FlatList, ActivityIndicator, TouchableOpacity, 
    Modal, ScrollView, TextInput, RefreshControl, Share, Animated, 
    Easing, Alert, StyleSheet, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import * as Clipboard from 'expo-clipboard';

const NAVY = '#0E1A2E';
const DEEP_NAVY = '#1E293B';
const GOLD = '#D9A73A';

// Forensic CSV Utility
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

// Professional Action Configuration
const getActionConfig = (action) => {
    const act = (action || '').toLowerCase();
    const config = { icon: 'information-circle-outline', color: '#64748B', bg: '#F8FAFC', label: 'General', impact: 'low' };

    if (act.includes('create') || act.includes('add')) {
        config.icon = 'add-circle'; config.color = '#059669'; config.bg = '#ECFDF5'; config.label = 'Create'; config.impact = 'medium';
    } else if (act.includes('update') || act.includes('edit')) {
        config.icon = 'sync-circle'; config.color = '#2563EB'; config.bg = '#EFF6FF'; config.label = 'Update'; config.impact = 'low';
    } else if (act.includes('delete') || act.includes('remove')) {
        config.icon = 'trash-outline'; config.color = '#EF4444'; config.bg = '#FEF2F2'; config.label = 'Delete'; config.impact = 'high';
    } else if (act.includes('login') || act.includes('auth')) {
        config.icon = 'shield-checkmark'; config.color = GOLD; config.bg = '#FFFBEB'; config.label = 'Security'; config.impact = 'medium';
    } else if (act.includes('wallet') || act.includes('payment') || act.includes('revenue') || act.includes('payout')) {
        config.icon = 'cash-outline'; config.color = '#D97706'; config.bg = '#FFFBEB'; config.label = 'Finance'; config.impact = 'high';
    } else if (act.includes('order')) {
        config.icon = 'cart-outline'; config.color = NAVY; config.bg = '#F1F5F9'; config.label = 'Order'; config.impact = 'low';
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
                    Animated.timing(pulseAnim, { toValue: 0.3, duration: 1000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) })
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [isLive]);

    const fetchLogs = useCallback(async (isRefresh = false) => {
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
    }, [filter, timeRange, discoveryPreset]);

    useEffect(() => {
        fetchLogs();
        const subscription = subscribeToLogs();
        return () => {
            if (subscription) supabase.removeChannel(subscription);
        };
    }, [fetchLogs]);

    const subscribeToLogs = () => {
        return supabase
            .channel('audit-logs-platinum-live')
            .on('postgres_changes', { event: 'INSERT', table: 'audit_logs' }, async (payload) => {
                let userData = null;
                if (payload.new.user_id) {
                    const { data } = await supabase
                        .from('profiles')
                        .select('full_name, email')
                        .eq('id', payload.new.user_id)
                        .maybeSingle();
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

        const todayCount = data.filter(l => l.created_at?.startsWith(today)).length;
        const securityCount = data.filter(l => l.action?.toLowerCase().includes('login')).length;
        const highImpactCount = data.filter(l => l.config?.impact === 'high').length;
        const velocity = data.filter(l => l.created_at >= hourAgo).length;

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
        try {
            if (Clipboard?.setStringAsync) {
                await Clipboard.setStringAsync(text);
            } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
                await navigator.clipboard.writeText(text);
            }
            Alert.alert('An Kwafa!', 'An saka bayanan bincike a clipboard.');
        } catch (e) {
            Alert.alert('Bayani', text);
        }
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
            await Share.share({ message: csvString, title: 'AbuMafhal_Audit_Logs.csv' });
        } catch (err) {
            console.error('Export Error:', err);
        } finally {
            setExporting(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchLogs(true);
    };

    const filteredLogsList = logs.filter(log => {
        const matchesSearch =
            (log.action || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (log.user?.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (log.details ? JSON.stringify(log.details).toLowerCase().includes(searchQuery.toLowerCase()) : false);
        return matchesSearch;
    });

    const renderLogItem = ({ item }) => {
        const date = new Date(item.created_at);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const impactColor = item.config.impact === 'high' ? '#EF4444' : item.config.impact === 'medium' ? GOLD : '#CBD5E1';

        return (
            <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setSelectedLog(item)}
                style={s.logCard}
            >
                <View style={[s.significanceBar, { backgroundColor: impactColor }]} />

                <View style={[s.actionIconBg, { backgroundColor: item.config.bg }]}>
                    <Ionicons name={item.config.icon} size={22} color={item.config.color} />
                </View>

                <View style={{ flex: 1 }}>
                    <View style={s.logCardTop}>
                        <Text style={s.logActionText} numberOfLines={1}>
                            {(item.action || 'Aiki').replace(/_/g, ' ')}
                        </Text>
                        <Text style={s.logTimeText}>{timeStr}</Text>
                    </View>

                    <Text style={s.logActorText} numberOfLines={1}>
                        <Text style={{ fontWeight: '800', color: NAVY }}>{item.user?.full_name || 'System Auto'}</Text>
                        {item.details_summary ? ` • ${item.details_summary}` : ''}
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <View style={s.categoryBadge}>
                            <Text style={s.categoryBadgeText}>{item.config.label}</Text>
                        </View>
                        {item.config.impact === 'high' && (
                            <View style={s.highImpactBadge}>
                                <Text style={s.highImpactBadgeText}>HIGH IMPACT</Text>
                            </View>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={s.container}>
            {/* Header */}
            <View style={s.header}>
                <View style={s.headerRow}>
                    <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons name="shield-checkmark" size={22} color={GOLD} />
                            <Text style={s.headerTitle}>Ayyukan Tsaro (Audit Logs)</Text>
                            <Animated.View style={[s.liveDot, { opacity: pulseAnim }]} />
                        </View>
                        <Text style={s.headerSubtitle}>
                            {isLive ? 'Binciken ayyuka yana aiki kai tsaye (Live)' : 'Ana kokarin sake hadawa...'}
                        </Text>
                    </View>

                    <TouchableOpacity 
                        onPress={exportToCSV} 
                        disabled={exporting} 
                        style={s.exportBtn}
                        activeOpacity={0.8}
                    >
                        {exporting ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons name="download-outline" size={16} color="#FFFFFF" />
                                <Text style={s.exportBtnText}>CSV</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Quick Stats Bar */}
                <View style={s.statsBar}>
                    <View style={s.statMiniItem}>
                        <Text style={s.statMiniVal}>{stats.today}</Text>
                        <Text style={s.statMiniLbl}>Yau (Today)</Text>
                    </View>
                    <View style={s.statMiniDivider} />
                    <View style={s.statMiniItem}>
                        <Text style={[s.statMiniVal, { color: GOLD }]}>{stats.security}</Text>
                        <Text style={s.statMiniLbl}>Security</Text>
                    </View>
                    <View style={s.statMiniDivider} />
                    <View style={s.statMiniItem}>
                        <Text style={[s.statMiniVal, { color: '#EF4444' }]}>{stats.highImpact}</Text>
                        <Text style={s.statMiniLbl}>High Impact</Text>
                    </View>
                    <View style={s.statMiniDivider} />
                    <View style={s.statMiniItem}>
                        <Text style={s.statMiniVal}>{stats.peakHour}</Text>
                        <Text style={s.statMiniLbl}>Peak Hour</Text>
                    </View>
                </View>

                {/* Search Bar */}
                <View style={s.searchWrap}>
                    <Ionicons name="search" size={16} color={GOLD} />
                    <TextInput 
                        placeholder="Bincika takamaiman aiki, suna ko cikakken bayani..." 
                        placeholderTextColor="#94A3B8"
                        value={searchQuery} 
                        onChangeText={setSearchQuery} 
                        style={s.searchInput} 
                    />
                </View>

                {/* Filter Presets */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {[
                        { id: null, label: 'All (Default)' },
                        { id: 'security', label: 'Security' },
                        { id: 'finance', label: 'Finance' },
                        { id: 'infra', label: 'System & Infra' }
                    ].map(p => (
                        <TouchableOpacity 
                            key={p.label} 
                            onPress={() => setDiscoveryPreset(p.id)} 
                            style={[s.presetPill, discoveryPreset === p.id && s.presetPillActive]}
                            activeOpacity={0.8}
                        >
                            <Text style={[s.presetPillText, discoveryPreset === p.id && s.presetPillTextActive]}>{p.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {loading && !refreshing ? (
                <View style={s.centered}>
                    <ActivityIndicator size="large" color={GOLD} />
                    <Text style={s.loadingText}>Ana binciko bayanan tsaro...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredLogsList}
                    renderItem={renderLogItem}
                    keyExtractor={item => item.id ? item.id.toString() : Math.random().toString()}
                    contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[GOLD, NAVY]} />}
                    ListEmptyComponent={
                        <View style={s.emptyBox}>
                            <View style={s.emptyIconCircle}>
                                <Ionicons name="shield-outline" size={38} color={GOLD} />
                            </View>
                            <Text style={s.emptyTitle}>Babu Wani Aiki Da Aka Samu</Text>
                            <Text style={s.emptySub}>
                                {searchQuery ? `Babu aikin da ya dace da "${searchQuery}"` : "Babu wani aikin da aka yi a wannan lokacin."}
                            </Text>
                        </View>
                    }
                />
            )}

            {/* DETAIL MODAL */}
            <Modal visible={!!selectedLog} animationType="slide" transparent onRequestClose={() => setSelectedLog(null)}>
                <View style={s.modalOverlay}>
                    <View style={s.modalCard}>
                        {selectedLog && (
                            <>
                                <View style={s.modalHeader}>
                                    <View>
                                        <Text style={s.modalActionTitle}>
                                            {(selectedLog.action || '').replace(/_/g, ' ').toUpperCase()}
                                        </Text>
                                        <Text style={s.modalTimeSub}>
                                            {new Date(selectedLog.created_at).toLocaleString()}
                                        </Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setSelectedLog(null)} style={s.closeCircleBtn}>
                                        <Ionicons name="close" size={20} color={NAVY} />
                                    </TouchableOpacity>
                                </View>

                                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
                                    <View style={s.actorCard}>
                                        <Ionicons name="person-circle-outline" size={36} color={GOLD} />
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <Text style={s.actorName}>{selectedLog.user?.full_name || 'System Automations'}</Text>
                                            <Text style={s.actorEmail}>{selectedLog.user?.email || selectedLog.user_id || 'Babu User ID'}</Text>
                                        </View>
                                    </View>

                                    <Text style={s.detailsSectionLabel}>CIKAKKEN BAYANIN AIKI (STRUCTURED DATA)</Text>
                                    <View style={s.jsonBox}>
                                        <Text style={s.jsonText}>
                                            {selectedLog.details ? JSON.stringify(selectedLog.details, null, 2) : 'Babu karin bayani (No Extra Payload)'}
                                        </Text>
                                    </View>

                                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                                        <TouchableOpacity
                                            onPress={() => copyToClipboard(JSON.stringify(selectedLog, null, 2))}
                                            style={s.copyBtn}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name="copy-outline" size={16} color={NAVY} />
                                            <Text style={s.copyBtnText}>Kwafi Bayani (Copy JSON)</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={() => setSelectedLog(null)}
                                            style={s.modalCloseBtn}
                                            activeOpacity={0.85}
                                        >
                                            <Text style={s.modalCloseBtnText}>Kammala</Text>
                                        </TouchableOpacity>
                                    </View>
                                </ScrollView>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC'
    },
    header: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 20 : 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14
    },
    headerTitle: {
        fontSize: 19,
        fontWeight: '900',
        color: NAVY
    },
    headerSubtitle: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 2
    },
    liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#059669'
    },
    exportBtn: {
        backgroundColor: NAVY,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: GOLD
    },
    exportBtnText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 12
    },
    statsBar: {
        flexDirection: 'row',
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 12
    },
    statMiniItem: {
        flex: 1,
        alignItems: 'center'
    },
    statMiniVal: {
        fontSize: 14,
        fontWeight: '900',
        color: NAVY
    },
    statMiniLbl: {
        fontSize: 9,
        color: '#64748B',
        fontWeight: '700',
        marginTop: 2
    },
    statMiniDivider: {
        width: 1,
        backgroundColor: '#E2E8F0'
    },
    searchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 12,
        paddingVertical: 9,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 12
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 13,
        color: NAVY,
        fontWeight: '600'
    },
    presetPill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    presetPillActive: {
        backgroundColor: NAVY,
        borderColor: NAVY
    },
    presetPillText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B'
    },
    presetPillTextActive: {
        color: GOLD,
        fontWeight: '800'
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40
    },
    loadingText: {
        marginTop: 12,
        color: '#64748B',
        fontSize: 14,
        fontWeight: '600'
    },
    logCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        marginBottom: 10,
        padding: 14,
        flexDirection: 'row',
        gap: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        position: 'relative',
        overflow: 'hidden'
    },
    significanceBar: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 4
    },
    actionIconBg: {
        width: 42,
        height: 42,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center'
    },
    logCardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 2
    },
    logActionText: {
        fontSize: 13,
        fontWeight: '800',
        color: NAVY,
        flex: 1,
        marginRight: 8
    },
    logTimeText: {
        fontSize: 10,
        color: '#94A3B8',
        fontWeight: '700'
    },
    logActorText: {
        fontSize: 12,
        color: '#64748B',
        marginBottom: 4
    },
    categoryBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    categoryBadgeText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#475569'
    },
    highImpactBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: '#FEF2F2'
    },
    highImpactBadgeText: {
        fontSize: 8,
        fontWeight: '900',
        color: '#EF4444'
    },
    emptyBox: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        marginTop: 40,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    emptyIconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#FFFBEB',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#FDE68A'
    },
    emptyTitle: {
        fontSize: 17,
        fontWeight: '900',
        color: NAVY,
        marginBottom: 6
    },
    emptySub: {
        fontSize: 13,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 18
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(14, 26, 46, 0.65)',
        justifyContent: 'flex-end'
    },
    modalCard: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        maxHeight: '85%'
    },
    modalHeader: {
        paddingHorizontal: 20,
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    modalActionTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: NAVY
    },
    modalTimeSub: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 2
    },
    closeCircleBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center'
    },
    actorCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        padding: 12,
        borderRadius: 14,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    actorName: {
        fontSize: 14,
        fontWeight: '800',
        color: NAVY
    },
    actorEmail: {
        fontSize: 11,
        color: '#64748B'
    },
    detailsSectionLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: '#64748B',
        marginBottom: 8,
        letterSpacing: 0.5
    },
    jsonBox: {
        backgroundColor: '#F8FAFC',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        maxHeight: 220
    },
    jsonText: {
        fontSize: 12,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        color: NAVY
    },
    copyBtn: {
        flex: 1,
        backgroundColor: '#FFFBEB',
        paddingVertical: 14,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: '#FDE68A'
    },
    copyBtnText: {
        color: NAVY,
        fontWeight: '800',
        fontSize: 13
    },
    modalCloseBtn: {
        flex: 1,
        backgroundColor: NAVY,
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center'
    },
    modalCloseBtnText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 13
    }
});
