import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, TextInput,
    ActivityIndicator, Modal, Alert, StyleSheet, Platform, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../../lib/supabase';

const NAVY = '#0E1A2E';
const TEAL = '#00BFA5';
const GOLD = '#D9A73A';
const SLATE_800 = '#1E293B';
const SLATE_500 = '#64748B';
const BORDER_LIGHT = '#E2E8F0';
const BG_LIGHT = '#F8FAFC';

export const AdminApiManagement = ({ navigation, onBack, user }) => {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [accessRequests, setAccessRequests] = useState([]);
    const [issuedKeys, setIssuedKeys] = useState([]);
    const [stats, setStats] = useState({
        totalRequests: 0,
        pendingApprovals: 0,
        activeKeys: 0,
        totalCalls: 0
    });
    const [activeTab, setActiveTab] = useState('requests'); // 'requests' | 'keys'
    const [searchQuery, setSearchQuery] = useState('');
    const [actionLoading, setActionLoading] = useState(null);
    const [revealedKeys, setRevealedKeys] = useState({});
    const [rejectModal, setRejectModal] = useState({ visible: false, vendorId: null, vendorName: '' });
    const [rejectReason, setRejectReason] = useState('');

    const officialDomain = 'https://www.abumafhal.com';

    const fetchData = useCallback(async () => {
        try {
            // 1. Try serverless admin api endpoint
            const res = await fetch(`${officialDomain}/api/v1/admin-api-keys`).catch(() => null);
            if (res && res.ok) {
                const json = await res.json();
                if (json.status === 'success') {
                    setAccessRequests(json.access_requests || []);
                    setIssuedKeys(json.issued_keys || []);
                    setStats({
                        totalRequests: json.stats?.total_requests || json.access_requests?.length || 0,
                        pendingApprovals: json.stats?.pending_requests || (json.access_requests || []).filter(r => r.status === 'pending').length,
                        activeKeys: json.stats?.active_keys || (json.issued_keys || []).filter(k => k.is_active).length,
                        totalCalls: json.stats?.total_calls || 0
                    });
                    setLoading(false);
                    return;
                }
            }

            // 2. Direct Supabase Fallback
            // Fetch requests from app_settings
            const { data: reqSettings } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'vendor_api_access_requests')
                .maybeSingle();

            const reqs = reqSettings?.value?.requests || [];
            setAccessRequests(reqs);

            // Fetch keys from vendor_api_keys table or app_settings
            let keys = [];
            const { data: tableKeys } = await supabase
                .from('vendor_api_keys')
                .select('*')
                .order('created_at', { ascending: false });

            if (tableKeys && tableKeys.length > 0) {
                keys = tableKeys;
            } else {
                const { data: keySettings } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('key', 'vendor_api_keys')
                    .maybeSingle();
                keys = keySettings?.value?.keys || [];
            }
            setIssuedKeys(keys);

            setStats({
                totalRequests: reqs.length,
                pendingApprovals: reqs.filter(r => r.status === 'pending').length,
                activeKeys: keys.filter(k => k.is_active !== false).length,
                totalCalls: keys.reduce((acc, k) => acc + Number(k.total_requests || 0), 0)
            });

        } catch (err) {
            console.error('Failed to load admin API data:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const handleApprove = async (vendorId) => {
        setActionLoading(`${vendorId}_approve`);
        try {
            // Update serverless
            const res = await fetch(`${officialDomain}/api/v1/admin-api-keys`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vendor_id: vendorId, action: 'approve' })
            }).catch(() => null);

            // Also update Supabase directly for safety
            await supabase
                .from('profiles')
                .update({ api_access_approved: true })
                .eq('id', vendorId);

            // Update app_settings queue
            const updated = accessRequests.map(r => r.vendor_id === vendorId ? { ...r, status: 'approved', reviewed_at: new Date().toISOString() } : r);
            await supabase
                .from('app_settings')
                .upsert({
                    key: 'vendor_api_access_requests',
                    value: { requests: updated },
                    updated_at: new Date().toISOString()
                });

            if (Platform.OS === 'web') alert('Vendor Developer API access approved!');
            else Alert.alert('Approved', 'Vendor Developer API access approved successfully.');

            fetchData();
        } catch (err) {
            if (Platform.OS === 'web') alert('Failed to approve: ' + err.message);
            else Alert.alert('Error', err.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleRejectSubmit = async () => {
        const { vendorId } = rejectModal;
        if (!vendorId) return;
        setActionLoading(`${vendorId}_reject`);

        try {
            await fetch(`${officialDomain}/api/v1/admin-api-keys`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vendor_id: vendorId, action: 'reject', reason: rejectReason })
            }).catch(() => null);

            await supabase
                .from('profiles')
                .update({ api_access_approved: false })
                .eq('id', vendorId);

            const updated = accessRequests.map(r => r.vendor_id === vendorId ? {
                ...r,
                status: 'rejected',
                admin_note: rejectReason,
                reviewed_at: new Date().toISOString()
            } : r);

            await supabase
                .from('app_settings')
                .upsert({
                    key: 'vendor_api_access_requests',
                    value: { requests: updated },
                    updated_at: new Date().toISOString()
                });

            setRejectModal({ visible: false, vendorId: null, vendorName: '' });
            setRejectReason('');

            if (Platform.OS === 'web') alert('API Access request rejected.');
            else Alert.alert('Rejected', 'API Access request declined.');

            fetchData();
        } catch (err) {
            if (Platform.OS === 'web') alert('Failed to decline: ' + err.message);
            else Alert.alert('Error', err.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleRevokeKey = (keyItem) => {
        const keyId = keyItem.id || keyItem.api_key;
        const confirmMsg = `Revoke API key "${keyItem.key_name || keyItem.api_key?.slice(0, 15)}..."? External integrations will fail immediately.`;

        const doRevoke = async () => {
            setActionLoading(`del_${keyId}`);
            try {
                await fetch(`${officialDomain}/api/v1/admin-api-keys`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ vendor_id: keyItem.vendor_id, action: 'revoke' })
                }).catch(() => null);

                await supabase
                    .from('vendor_api_keys')
                    .update({ is_active: false })
                    .eq('api_key', keyItem.api_key);

                if (Platform.OS === 'web') alert('API key revoked.');
                else Alert.alert('Revoked', 'Key disabled successfully.');
                fetchData();
            } catch (err) {
                if (Platform.OS === 'web') alert(err.message);
            } finally {
                setActionLoading(null);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(confirmMsg)) doRevoke();
        } else {
            Alert.alert('Confirm Revocation', confirmMsg, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Revoke Key', style: 'destructive', onPress: doRevoke }
            ]);
        }
    };

    const handleCopy = async (text, label) => {
        await Clipboard.setStringAsync(text);
        if (Platform.OS === 'web') alert(`Copied ${label} to clipboard!`);
        else Alert.alert('Copied', `${label} copied to clipboard.`);
    };

    const filteredRequests = accessRequests.filter(r => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (r.vendor_name || '').toLowerCase().includes(q) ||
               (r.vendor_email || '').toLowerCase().includes(q) ||
               (r.note || '').toLowerCase().includes(q);
    });

    const filteredKeys = issuedKeys.filter(k => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (k.key_name || '').toLowerCase().includes(q) ||
               (k.api_key || '').toLowerCase().includes(q) ||
               (k.vendor_name || '').toLowerCase().includes(q);
    });

    return (
        <View style={s.container}>
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={s.headerTitle}>Developer API Governance</Text>
                    <Text style={s.headerSubtitle}>Approve vendor integration requests & keys</Text>
                </View>
                <TouchableOpacity onPress={onRefresh} style={s.refreshBtn} activeOpacity={0.7}>
                    <Ionicons name="refresh" size={18} color={GOLD} />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[TEAL]} />}
            >
                {/* 4 KPI Metrics */}
                <View style={s.kpiGrid}>
                    <View style={s.kpiCard}>
                        <View style={[s.kpiIconBox, { backgroundColor: 'rgba(217, 167, 58, 0.15)' }]}>
                            <Ionicons name="time" size={16} color={GOLD} />
                        </View>
                        <Text style={s.kpiValue}>{stats.pendingApprovals}</Text>
                        <Text style={s.kpiLabel}>Pending Review</Text>
                    </View>

                    <View style={s.kpiCard}>
                        <View style={[s.kpiIconBox, { backgroundColor: 'rgba(0, 191, 165, 0.15)' }]}>
                            <Ionicons name="shield-checkmark" size={16} color={TEAL} />
                        </View>
                        <Text style={s.kpiValue}>{accessRequests.filter(r => r.status === 'approved').length}</Text>
                        <Text style={s.kpiLabel}>Approved Stores</Text>
                    </View>

                    <View style={s.kpiCard}>
                        <View style={[s.kpiIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                            <Ionicons name="key" size={16} color="#3B82F6" />
                        </View>
                        <Text style={s.kpiValue}>{stats.activeKeys}</Text>
                        <Text style={s.kpiLabel}>Active API Keys</Text>
                    </View>

                    <View style={s.kpiCard}>
                        <View style={[s.kpiIconBox, { backgroundColor: 'rgba(147, 51, 234, 0.15)' }]}>
                            <Ionicons name="analytics" size={16} color="#9333EA" />
                        </View>
                        <Text style={s.kpiValue}>{stats.totalCalls}</Text>
                        <Text style={s.kpiLabel}>Total API Calls</Text>
                    </View>
                </View>

                {/* Tab Switcher */}
                <View style={s.tabSwitchWrap}>
                    <TouchableOpacity
                        onPress={() => setActiveTab('requests')}
                        style={[s.tabBtn, activeTab === 'requests' && s.tabBtnActive]}
                    >
                        <Ionicons name="document-text-outline" size={15} color={activeTab === 'requests' ? '#0A192F' : '#94A3B8'} />
                        <Text style={[s.tabBtnText, activeTab === 'requests' && s.tabBtnTextActive]}>
                            Access Requests ({accessRequests.length})
                        </Text>
                        {stats.pendingApprovals > 0 && (
                            <View style={s.pendingBadge}>
                                <Text style={s.pendingBadgeText}>{stats.pendingApprovals}</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setActiveTab('keys')}
                        style={[s.tabBtn, activeTab === 'keys' && s.tabBtnActive]}
                    >
                        <Ionicons name="key-outline" size={15} color={activeTab === 'keys' ? '#0A192F' : '#94A3B8'} />
                        <Text style={[s.tabBtnText, activeTab === 'keys' && s.tabBtnTextActive]}>
                            Issued Keys ({issuedKeys.length})
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={s.searchWrap}>
                    <Ionicons name="search" size={16} color="#94A3B8" />
                    <TextInput
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder={activeTab === 'requests' ? "Search requests by vendor name..." : "Search keys by name or API token..."}
                        placeholderTextColor="#94A3B8"
                        style={s.searchInput}
                    />
                    {searchQuery ? (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={16} color="#94A3B8" />
                        </TouchableOpacity>
                    ) : null}
                </View>

                {/* Content */}
                {loading ? (
                    <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                        <ActivityIndicator size="large" color={TEAL} />
                        <Text style={{ fontSize: 12, color: SLATE_500, marginTop: 8 }}>Loading API governance data...</Text>
                    </View>
                ) : activeTab === 'requests' ? (
                    /* ─── REQUESTS LIST ─── */
                    filteredRequests.length === 0 ? (
                        <View style={s.emptyBox}>
                            <Ionicons name="shield-outline" size={40} color="#CBD5E1" />
                            <Text style={s.emptyTitle}>No API Access Requests</Text>
                            <Text style={s.emptySub}>When vendors submit developer requests, they appear here for your review.</Text>
                        </View>
                    ) : (
                        filteredRequests.map((reqItem) => {
                            const isPending = reqItem.status === 'pending';
                            const isApproved = reqItem.status === 'approved';
                            const isRejected = reqItem.status === 'rejected';
                            const isLoading = actionLoading?.startsWith(reqItem.vendor_id);

                            return (
                                <View key={reqItem.id || reqItem.vendor_id} style={s.card}>
                                    <View style={s.cardTopRow}>
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <Text style={s.vendorName}>{reqItem.vendor_name || 'Vendor'}</Text>
                                                <View style={[
                                                    s.statusPill,
                                                    isApproved ? s.statusApproved : isPending ? s.statusPending : s.statusRejected
                                                ]}>
                                                    <Text style={[
                                                        s.statusPillText,
                                                        isApproved ? { color: '#047857' } : isPending ? { color: '#B45309' } : { color: '#B91C1C' }
                                                    ]}>
                                                        {reqItem.status ? reqItem.status.toUpperCase() : 'PENDING'}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Text style={s.vendorEmail}>{reqItem.vendor_email || 'No email provided'}</Text>
                                        </View>
                                        <Text style={s.dateText}>
                                            {reqItem.requested_at ? new Date(reqItem.requested_at).toLocaleDateString() : 'Recent'}
                                        </Text>
                                    </View>

                                    {/* Use Case Note */}
                                    <View style={s.noteBox}>
                                        <Text style={s.noteLabel}>Integration Use Case / Reason:</Text>
                                        <Text style={s.noteText}>
                                            {reqItem.note ? `"${reqItem.note}"` : 'General catalog and order synchronization.'}
                                        </Text>
                                    </View>

                                    {/* Admin Note if Rejected */}
                                    {reqItem.admin_note ? (
                                        <View style={[s.noteBox, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                                            <Text style={[s.noteLabel, { color: '#991B1B' }]}>Decline Reason:</Text>
                                            <Text style={[s.noteText, { color: '#7F1D1D' }]}>{reqItem.admin_note}</Text>
                                        </View>
                                    ) : null}

                                    {/* Action Buttons */}
                                    <View style={s.actionRow}>
                                        {isLoading ? (
                                            <ActivityIndicator size="small" color={TEAL} style={{ marginVertical: 8 }} />
                                        ) : isPending ? (
                                            <>
                                                <TouchableOpacity
                                                    onPress={() => handleApprove(reqItem.vendor_id)}
                                                    style={s.approveBtn}
                                                    activeOpacity={0.8}
                                                >
                                                    <Ionicons name="checkmark-circle" size={15} color="#FFFFFF" />
                                                    <Text style={s.approveBtnText}>Approve API Access</Text>
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    onPress={() => setRejectModal({ visible: true, vendorId: reqItem.vendor_id, vendorName: reqItem.vendor_name || 'Vendor' })}
                                                    style={s.rejectBtn}
                                                    activeOpacity={0.8}
                                                >
                                                    <Ionicons name="close-circle" size={15} color="#DC2626" />
                                                    <Text style={s.rejectBtnText}>Decline</Text>
                                                </TouchableOpacity>
                                            </>
                                        ) : isApproved ? (
                                            <TouchableOpacity
                                                onPress={() => setRejectModal({ visible: true, vendorId: reqItem.vendor_id, vendorName: reqItem.vendor_name || 'Vendor' })}
                                                style={[s.rejectBtn, { flex: 1 }]}
                                                activeOpacity={0.8}
                                            >
                                                <Ionicons name="ban-outline" size={15} color="#DC2626" />
                                                <Text style={s.rejectBtnText}>Revoke Access Permission</Text>
                                            </TouchableOpacity>
                                        ) : (
                                            <TouchableOpacity
                                                onPress={() => handleApprove(reqItem.vendor_id)}
                                                style={[s.approveBtn, { flex: 1 }]}
                                                activeOpacity={0.8}
                                            >
                                                <Ionicons name="refresh" size={15} color="#FFFFFF" />
                                                <Text style={s.approveBtnText}>Re-Approve Access</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            );
                        })
                    )
                ) : (
                    /* ─── ISSUED KEYS LIST ─── */
                    filteredKeys.length === 0 ? (
                        <View style={s.emptyBox}>
                            <Ionicons name="key-outline" size={40} color="#CBD5E1" />
                            <Text style={s.emptyTitle}>No Issued API Keys</Text>
                            <Text style={s.emptySub}>Approved vendors who generate API credentials will appear here.</Text>
                        </View>
                    ) : (
                        filteredKeys.map((k) => {
                            const isRevealed = revealedKeys[k.id || k.api_key];
                            const keySnippet = isRevealed ? k.api_key : `${k.api_key?.substring(0, 16)}••••••••••••`;
                            const isLive = k.api_key?.startsWith('abumafhal_live_') || k.key_type === 'live';

                            return (
                                <View key={k.id || k.api_key} style={s.card}>
                                    <View style={s.cardTopRow}>
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <Text style={s.vendorName}>{k.key_name || 'Production Key'}</Text>
                                                <View style={[s.statusPill, isLive ? s.statusLive : s.statusTest]}>
                                                    <Text style={[s.statusPillText, isLive ? { color: '#047857' } : { color: '#D97706' }]}>
                                                        {isLive ? 'LIVE' : 'SANDBOX'}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Text style={s.vendorEmail}>Vendor ID: {k.vendor_id?.substring(0, 12)}...</Text>
                                        </View>

                                        <TouchableOpacity
                                            onPress={() => handleRevokeKey(k)}
                                            style={s.trashBtn}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name="trash-outline" size={15} color="#DC2626" />
                                        </TouchableOpacity>
                                    </View>

                                    {/* Key Display Box */}
                                    <View style={s.keyDisplayBox}>
                                        <Text style={s.keyDisplayText} numberOfLines={1}>{keySnippet}</Text>
                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                            <TouchableOpacity
                                                onPress={() => setRevealedKeys(prev => ({ ...prev, [k.id || k.api_key]: !isRevealed }))}
                                                style={s.keyActionBtn}
                                            >
                                                <Ionicons name={isRevealed ? "eye-off-outline" : "eye-outline"} size={14} color="#64748B" />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => handleCopy(k.api_key, 'API Key')}
                                                style={s.keyActionBtn}
                                            >
                                                <Ionicons name="copy-outline" size={14} color={TEAL} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    {/* Stats Row */}
                                    <View style={s.keyStatsRow}>
                                        <Text style={s.keyStatItem}>Rate Limit: <Text style={{ fontWeight: 'bold', color: SLATE_800 }}>120/min</Text></Text>
                                        <Text style={s.keyStatItem}>Calls: <Text style={{ fontWeight: 'bold', color: TEAL }}>{k.total_requests || 0}</Text></Text>
                                        <Text style={s.keyStatItem}>Status: <Text style={{ fontWeight: 'bold', color: k.is_active !== false ? '#059669' : '#DC2626' }}>{k.is_active !== false ? 'Active' : 'Revoked'}</Text></Text>
                                    </View>
                                </View>
                            );
                        })
                    )
                )}
            </ScrollView>

            {/* Reject Modal */}
            <Modal
                visible={rejectModal.visible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setRejectModal({ visible: false, vendorId: null, vendorName: '' })}
            >
                <View style={s.modalOverlay}>
                    <View style={s.modalCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <Ionicons name="alert-circle" size={22} color="#DC2626" />
                            <Text style={s.modalTitle}>Decline API Access</Text>
                        </View>
                        <Text style={s.modalDesc}>
                            Provide constructive feedback for {rejectModal.vendorName} explaining why this API request cannot be approved at this time.
                        </Text>
                        <TextInput
                            value={rejectReason}
                            onChangeText={setRejectReason}
                            placeholder="Reason (e.g. Incomplete KYC, store catalog not yet published)..."
                            placeholderTextColor="#94A3B8"
                            multiline
                            style={s.modalInput}
                        />
                        <View style={s.modalBtnRow}>
                            <TouchableOpacity
                                onPress={() => setRejectModal({ visible: false, vendorId: null, vendorName: '' })}
                                style={s.modalCancelBtn}
                            >
                                <Text style={s.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleRejectSubmit}
                                style={s.modalSubmitBtn}
                            >
                                <Text style={s.modalSubmitText}>Decline Request</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: BG_LIGHT
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 48 : 20,
        paddingBottom: 16,
        backgroundColor: NAVY,
        borderBottomWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.25)'
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: '#FFFFFF'
    },
    headerSubtitle: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 1
    },
    refreshBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(217, 167, 58, 0.15)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    kpiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 14
    },
    kpiCard: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: BORDER_LIGHT
    },
    kpiIconBox: {
        width: 28,
        height: 28,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6
    },
    kpiValue: {
        fontSize: 18,
        fontWeight: '900',
        color: SLATE_800
    },
    kpiLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: SLATE_500,
        textTransform: 'uppercase',
        marginTop: 2
    },
    tabSwitchWrap: {
        flexDirection: 'row',
        backgroundColor: '#E2E8F0',
        borderRadius: 14,
        padding: 3,
        marginBottom: 12
    },
    tabBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 9,
        borderRadius: 11
    },
    tabBtnActive: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
        elevation: 2
    },
    tabBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B'
    },
    tabBtnTextActive: {
        color: '#0A192F',
        fontWeight: '900'
    },
    pendingBadge: {
        backgroundColor: GOLD,
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 10
    },
    pendingBadgeText: {
        fontSize: 9,
        fontWeight: '900',
        color: '#0A192F'
    },
    searchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: BORDER_LIGHT,
        marginBottom: 14
    },
    searchInput: {
        flex: 1,
        paddingVertical: 9,
        paddingHorizontal: 8,
        fontSize: 12,
        color: SLATE_800
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: BORDER_LIGHT,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1
    },
    cardTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 10
    },
    vendorName: {
        fontSize: 14,
        fontWeight: '900',
        color: SLATE_800
    },
    vendorEmail: {
        fontSize: 11,
        color: SLATE_500,
        marginTop: 2
    },
    dateText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#94A3B8'
    },
    statusPill: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10
    },
    statusApproved: {
        backgroundColor: '#D1FAE5'
    },
    statusPending: {
        backgroundColor: '#FEF3C7'
    },
    statusRejected: {
        backgroundColor: '#FEE2E2'
    },
    statusLive: {
        backgroundColor: '#D1FAE5'
    },
    statusTest: {
        backgroundColor: '#FEF3C7'
    },
    statusPillText: {
        fontSize: 9.5,
        fontWeight: '900'
    },
    noteBox: {
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        padding: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 10
    },
    noteLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: SLATE_500,
        marginBottom: 2
    },
    noteText: {
        fontSize: 11.5,
        color: SLATE_800,
        fontStyle: 'italic',
        lineHeight: 16
    },
    actionRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 4
    },
    approveBtn: {
        flex: 2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        backgroundColor: '#059669',
        paddingVertical: 9,
        borderRadius: 10
    },
    approveBtnText: {
        color: '#FFFFFF',
        fontSize: 11.5,
        fontWeight: '800'
    },
    rejectBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FECACA',
        paddingVertical: 9,
        borderRadius: 10
    },
    rejectBtnText: {
        color: '#DC2626',
        fontSize: 11.5,
        fontWeight: '700'
    },
    trashBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FECACA',
        alignItems: 'center',
        justifyContent: 'center'
    },
    keyDisplayBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#0A1220',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 8
    },
    keyDisplayText: {
        fontSize: 11,
        color: '#38BDF8',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        flex: 1,
        marginRight: 8
    },
    keyActionBtn: {
        padding: 4
    },
    keyStatsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderColor: '#F1F5F9',
        paddingTop: 8,
        marginTop: 2
    },
    keyStatItem: {
        fontSize: 10.5,
        color: SLATE_500
    },
    emptyBox: {
        alignItems: 'center',
        paddingVertical: 40,
        paddingHorizontal: 20
    },
    emptyTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: SLATE_800,
        marginTop: 10
    },
    emptySub: {
        fontSize: 11,
        color: SLATE_500,
        textAlign: 'center',
        marginTop: 4,
        maxWidth: 260
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        padding: 20
    },
    modalCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 5
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: SLATE_800
    },
    modalDesc: {
        fontSize: 12,
        color: SLATE_500,
        marginBottom: 12,
        lineHeight: 17
    },
    modalInput: {
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 12,
        padding: 12,
        fontSize: 12,
        color: SLATE_800,
        height: 80,
        textAlignVertical: 'top',
        marginBottom: 14
    },
    modalBtnRow: {
        flexDirection: 'row',
        gap: 10
    },
    modalCancelBtn: {
        flex: 1,
        paddingVertical: 11,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        alignItems: 'center'
    },
    modalCancelText: {
        fontSize: 12,
        fontWeight: '700',
        color: SLATE_600
    },
    modalSubmitBtn: {
        flex: 1,
        paddingVertical: 11,
        borderRadius: 10,
        backgroundColor: '#DC2626',
        alignItems: 'center'
    },
    modalSubmitText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#FFFFFF'
    }
});

export default AdminApiManagement;
