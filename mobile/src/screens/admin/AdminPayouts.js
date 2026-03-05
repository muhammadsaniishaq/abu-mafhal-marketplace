import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert, Modal, TextInput, ScrollView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from '../../lib/supabase';
import { styles } from '../../styles/theme';

export const AdminPayouts = () => {
    const [withdrawals, setWithdrawals] = useState([]);
    const [filteredWithdrawals, setFilteredWithdrawals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [adminNote, setAdminNote] = useState('');
    const [filter, setFilter] = useState('pending'); // 'all', 'pending', 'paid', 'rejected'
    const [dateRange, setDateRange] = useState('all'); // 'all', 'today', 'week', 'month'
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        fetchWithdrawalRequests();
    }, []);

    useEffect(() => {
        let result = withdrawals;

        // Apply Status Filter
        if (filter !== 'all') {
            result = result.filter(w => w.status === filter);
        }

        // Apply Date Range Filter
        if (dateRange !== 'all') {
            const now = new Date();
            let startDate = new Date();

            if (dateRange === 'today') {
                startDate.setHours(0, 0, 0, 0);
            } else if (dateRange === 'week') {
                startDate.setDate(now.getDate() - 7);
            } else if (dateRange === 'month') {
                startDate.setMonth(now.getMonth() - 1);
            }

            result = result.filter(w => new Date(w.created_at) >= startDate);
        }

        // Apply Search Filter
        if (searchQuery.trim() !== '') {
            const query = searchQuery.toLowerCase();
            result = result.filter(w =>
                w.profiles?.full_name?.toLowerCase().includes(query) ||
                w.profiles?.email?.toLowerCase().includes(query) ||
                w.bank_name?.toLowerCase().includes(query) ||
                w.account_number?.includes(query)
            );
        }

        setFilteredWithdrawals(result);
    }, [filter, dateRange, searchQuery, withdrawals]);

    const fetchWithdrawalRequests = async () => {
        try {
            setLoading(true);

            // Fetch Vendor Payouts
            const { data: vPayouts, error: vError } = await supabase
                .from('vendor_payouts')
                .select('*, profiles:vendor_id(full_name, email)')
                .order('created_at', { ascending: false })
                .limit(50);
            if (vError) throw vError;

            // Fetch Driver Payouts
            const { data: dPayouts, error: dError } = await supabase
                .from('driver_payouts')
                .select('*, drivers:driver_id(name, user_id, profiles(full_name, email))')
                .order('created_at', { ascending: false })
                .limit(50);
            if (dError) throw dError;

            // Map and combine
            const mappedVendors = (vPayouts || []).map(p => ({
                ...p,
                role: 'Vendor',
                table_source: 'vendor_payouts',
                target_user_id: p.vendor_id || p.user_id, // ensure user_id is found for refund
                profiles: p.profiles || { full_name: 'Unknown Vendor', email: 'N/A' }
            }));

            const mappedDrivers = (dPayouts || []).map(p => ({
                ...p,
                role: 'Driver',
                table_source: 'driver_payouts',
                target_user_id: p.drivers?.user_id || p.driver_id,
                profiles: p.drivers?.profiles ? {
                    full_name: p.drivers.name || p.drivers.profiles.full_name,
                    email: p.drivers.profiles.email
                } : { full_name: 'Unknown Driver', email: 'N/A' }
            }));

            const combined = [...mappedVendors, ...mappedDrivers].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            setWithdrawals(combined);
        } catch (error) {
            console.error('Error fetching payouts:', error);
            Alert.alert('Network Error', 'Could not load payout requests. Please check your connection.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchWithdrawalRequests();
    };

    const processRequest = async (status) => {
        if (!selectedRequest) return;

        Alert.alert(
            "Confirm " + (status === 'paid' ? 'Payment' : 'Rejection'),
            "Are you sure you want to mark this request as " + status + "?" + (status === 'rejected' ? " The amount will be refunded to the vendor's wallet." : ""),
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm',
                    style: status === 'rejected' ? 'destructive' : 'default',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const { error: updateError } = await supabase
                                .from(selectedRequest.table_source)
                                .update({ status, admin_note: adminNote })
                                .eq('id', selectedRequest.id);

                            if (updateError) throw updateError;

                            if (status === 'rejected') {
                                const { data: walletData, error: walletFetchError } = await supabase
                                    .from('wallets')
                                    .select('balance')
                                    .eq('user_id', selectedRequest.target_user_id)
                                    .single();

                                if (walletFetchError) throw walletFetchError;

                                const newBalance = (walletData.balance || 0) + selectedRequest.amount;

                                const { error: walletUpdateError } = await supabase
                                    .from('wallets')
                                    .update({ balance: newBalance })
                                    .eq('user_id', selectedRequest.target_user_id);

                                if (walletUpdateError) throw walletUpdateError;
                            }

                            Alert.alert('Success', `Request marked as ${status}${status === 'rejected' ? ' and refunded' : ''}.`);
                            setSelectedRequest(null);
                            setAdminNote('');
                            fetchWithdrawalRequests();

                        } catch (error) {
                            console.error('Processing error:', error);
                            Alert.alert('Error', error.message || 'Failed to process request.');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const handleExport = async () => {
        try {
            setIsExporting(true);
            const htmlContent = `
                <html>
                    <head>
                        <style>
                            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
                            h1 { text-align: center; color: #0F172A; }
                            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                            th, td { border: 1px solid #E2E8F0; padding: 12px; text-align: left; }
                            th { background-color: #F8FAFC; color: #475569; font-weight: bold; }
                            tr:nth-child(even) { background-color: #F8FAFC; }
                            .amount { font-weight: bold; }
                            .status-paid { color: #16A34A; font-weight: bold; }
                            .status-pending { color: #D97706; font-weight: bold; }
                            .status-rejected { color: #DC2626; font-weight: bold; }
                        </style>
                    </head>
                    <body>
                        <h1>Payouts Report 
                            (${dateRange === 'all' ? 'All Time' : dateRange === 'today' ? 'Today' : dateRange === 'week' ? 'Last 7 Days' : 'Last 30 Days'})
                        </h1>
                        <p>Total Records: ${filteredWithdrawals.length}</p>
                        <table>
                            <tr>
                                <th>Date</th>
                                <th>Vendor</th>
                                <th>Bank Details</th>
                                <th>Amount (₦)</th>
                                <th>Status</th>
                            </tr>
                            ${filteredWithdrawals.map(w => `
                                <tr>
                                    <td>${new Date(w.created_at).toLocaleDateString()}</td>
                                    <td>${w.profiles?.full_name || 'N/A'}<br/><small>${w.profiles?.email || ''}</small></td>
                                    <td>${w.bank_name}<br/><small>${w.account_number}</small></td>
                                    <td class="amount">${w.amount?.toLocaleString()}</td>
                                    <td class="status-${w.status}">${w.status.toUpperCase()}</td>
                                </tr>
                            `).join('')}
                        </table>
                    </body>
                </html>
            `;

            const { uri } = await Print.printToFileAsync({ html: htmlContent });

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, { dialogTitle: 'Export Payouts Report' });
            } else {
                Alert.alert('Success', 'Report generated, but sharing is not available on this device.');
            }
        } catch (error) {
            console.error('Export error:', error);
            Alert.alert('Export Failed', 'An error occurred while generating the report.');
        } finally {
            setIsExporting(false);
        }
    };

    const totalPendingAmount = withdrawals.filter(w => w.status === 'pending').reduce((sum, w) => sum + (w.amount || 0), 0);
    const pendingCount = withdrawals.filter(w => w.status === 'pending').length;
    const totalCompletedAmount = withdrawals.filter(w => w.status === 'paid').reduce((sum, w) => sum + (w.amount || 0), 0);

    const renderItem = ({ item }) => (
        <TouchableOpacity
            onPress={() => setSelectedRequest(item)}
            style={{ backgroundColor: 'white', padding: 16, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: "#64748B", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 }}
        >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: item.status === 'pending' ? '#FFFBEB' : '#F8FAFC', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: item.status === 'pending' ? '#FEF3C7' : '#E2E8F0' }}>
                        <Text style={{ fontWeight: '800', color: item.status === 'pending' ? '#D97706' : '#475569', fontSize: 16 }}>{item.profiles?.full_name?.charAt(0) || item.role?.charAt(0) || 'V'}</Text>
                    </View>
                    <View>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 2 }}>{item.profiles?.full_name || item.role}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={{ backgroundColor: item.role === 'Driver' ? '#E0E7FF' : '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                <Text style={{ fontSize: 9, fontWeight: '800', color: item.role === 'Driver' ? '#4338CA' : '#64748B', textTransform: 'uppercase' }}>{item.role}</Text>
                            </View>
                            <Text style={{ fontSize: 12, color: '#64748B' }}>{item.profiles?.email}</Text>
                        </View>
                    </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontWeight: '900', color: '#0F172A', fontSize: 18, letterSpacing: -0.5 }}>₦{item.amount?.toLocaleString()}</Text>
                    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: item.status === 'paid' ? '#DCFCE7' : item.status === 'pending' ? '#FEF3C7' : item.status === 'rejected' ? '#FEE2E2' : '#F1F5F9', marginTop: 6 }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: item.status === 'paid' ? '#166534' : item.status === 'pending' ? '#D97706' : item.status === 'rejected' ? '#991B1B' : '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.status}</Text>
                    </View>
                </View>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ backgroundColor: 'white', padding: 6, borderRadius: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
                        <Ionicons name="business" size={14} color="#64748B" />
                    </View>
                    <Text style={{ fontSize: 13, color: '#475569', fontWeight: '700' }}>{item.bank_name}</Text>
                </View>
                <Text style={{ fontSize: 12, color: '#94A3B8', fontWeight: '600' }}>{new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            {/* Header / Premium Stats */}
            <View style={{ backgroundColor: '#0F172A', padding: 24, paddingBottom: 40, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, position: 'relative', overflow: 'hidden' }}>
                <View style={{ position: 'absolute', right: -40, top: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(59,130,246,0.1)' }} />

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <Text style={{ color: 'white', fontSize: 28, fontWeight: '900', letterSpacing: -0.5 }}>Payout Console</Text>
                    <TouchableOpacity
                        onPress={handleExport}
                        disabled={isExporting || filteredWithdrawals.length === 0}
                        style={{ backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: (isExporting || filteredWithdrawals.length === 0) ? 0.5 : 1 }}
                    >
                        {isExporting ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="download-outline" size={16} color="white" />}
                        <Text style={{ color: 'white', fontSize: 13, fontWeight: '700' }}>Export PDF</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <Ionicons name="time" size={16} color="#FCD34D" />
                            <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>Pending</Text>
                        </View>
                        <Text style={{ color: 'white', fontSize: 24, fontWeight: '900', letterSpacing: -1 }}>₦{totalPendingAmount.toLocaleString()}</Text>
                        <Text style={{ color: '#FCD34D', fontSize: 12, marginTop: 4, fontWeight: '600' }}>{pendingCount} Request{pendingCount !== 1 && 's'}</Text>
                    </View>

                    <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <Ionicons name="checkmark-circle" size={16} color="#6EE7B7" />
                            <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>Paid Out</Text>
                        </View>
                        <Text style={{ color: 'white', fontSize: 24, fontWeight: '900', letterSpacing: -1 }}>₦{totalCompletedAmount.toLocaleString()}</Text>
                        <Text style={{ color: '#6EE7B7', fontSize: 12, marginTop: 4, fontWeight: '600' }}>All Time</Text>
                    </View>
                </View>
            </View>

            {/* Sticky Search & Filter Bar */}
            <View style={{ marginTop: -20, paddingHorizontal: 20, zIndex: 10 }}>
                <View style={{ backgroundColor: 'white', borderRadius: 24, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 8 }}>
                        <Ionicons name="search" size={20} color="#94A3B8" />
                        <TextInput
                            style={{ flex: 1, marginLeft: 10, fontSize: 15, color: '#0F172A', fontWeight: '500' }}
                            placeholder="Search name, email, or bank..."
                            placeholderTextColor="#94A3B8"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={20} color="#CBD5E1" />
                            </TouchableOpacity>
                        )}
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 4 }}>
                        {['pending', 'all', 'paid', 'rejected'].map(f => (
                            <TouchableOpacity
                                key={f}
                                onPress={() => setFilter(f)}
                                style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: filter === f ? '#0F172A' : 'transparent', marginRight: 4 }}
                            >
                                <Text style={{ fontSize: 13, fontWeight: '800', color: filter === f ? 'white' : '#64748B', textTransform: 'capitalize' }}>
                                    {f} {f === 'pending' && pendingCount > 0 ? `(${pendingCount})` : ''}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Date Filters */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 4, marginTop: 12, paddingBottom: 8 }}>
                    {[
                        { id: 'all', label: 'All Time' },
                        { id: 'today', label: 'Today' },
                        { id: 'week', label: 'Last 7 Days' },
                        { id: 'month', label: 'Last 30 Days' }
                    ].map(d => (
                        <TouchableOpacity
                            key={d.id}
                            onPress={() => setDateRange(d.id)}
                            style={{
                                paddingHorizontal: 16,
                                paddingVertical: 8,
                                borderRadius: 12,
                                backgroundColor: dateRange === d.id ? '#E0E7FF' : 'white',
                                marginRight: 8,
                                borderWidth: 1,
                                borderColor: dateRange === d.id ? '#818CF8' : '#E2E8F0'
                            }}
                        >
                            <Text style={{ fontSize: 13, fontWeight: dateRange === d.id ? '800' : '600', color: dateRange === d.id ? '#4338CA' : '#64748B' }}>
                                {d.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* List */}
            {loading && !refreshing ? <ActivityIndicator color="#3B82F6" style={{ marginTop: 60 }} size="large" /> : (
                <FlatList
                    data={filteredWithdrawals}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, paddingTop: 24 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#3B82F6']} />}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', marginTop: 40, padding: 32, backgroundColor: 'white', borderRadius: 24, borderWidth: 1, borderColor: '#F1F5F9' }}>
                            <Ionicons name="wallet-outline" size={48} color="#CBD5E1" style={{ marginBottom: 16 }} />
                            <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 8 }}>No Requests Found</Text>
                            <Text style={{ textAlign: 'center', color: '#64748B', fontSize: 14 }}>
                                {searchQuery ? `We couldn't find any payouts matching "${searchQuery}".` : `There are no ${filter !== 'all' ? filter : ''} withdrawal requests at this time.`}
                            </Text>
                        </View>
                    }
                />
            )}

            {/* Advanced Action Modal */}
            <Modal visible={!!selectedRequest} animationType="slide" transparent>
                <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.7)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: 'white', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, maxHeight: '90%' }}>
                        {selectedRequest && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                                    <View>
                                        <Text style={{ fontSize: 24, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 }}>Process Request</Text>
                                        <Text style={{ color: '#64748B', fontSize: 13, marginTop: 4 }}>ID: {selectedRequest.id?.substring(0, 8)}...</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setSelectedRequest(null)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
                                        <Ionicons name="close" size={24} color="#64748B" />
                                    </TouchableOpacity>
                                </View>

                                {/* Premium Amount Display */}
                                <View style={{ backgroundColor: '#0F172A', padding: 24, borderRadius: 24, marginBottom: 24, alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 8 }}>
                                    <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Requested Amount</Text>
                                    <Text style={{ fontSize: 40, fontWeight: '900', color: 'white', letterSpacing: -1 }}>₦{selectedRequest.amount?.toLocaleString()}</Text>
                                    <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 12 }}>
                                        <Text style={{ color: '#CBD5E1', fontSize: 12, fontWeight: '600' }}>{new Date(selectedRequest.created_at).toLocaleString()}</Text>
                                    </View>
                                </View>

                                {/* Combined Details Card */}
                                <View style={{ backgroundColor: '#F8FAFC', borderRadius: 24, borderWidth: 1, borderColor: '#E2E8F0', padding: 20, marginBottom: 24 }}>

                                    <Text style={{ color: '#0F172A', fontSize: 16, fontWeight: '800', marginBottom: 16 }}>User Profile</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                                        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#E0E7FF', alignItems: 'center', justifyContent: 'center' }}>
                                            <Text style={{ color: '#4338CA', fontWeight: '800', fontSize: 18 }}>{selectedRequest.profiles?.full_name?.charAt(0) || selectedRequest.role?.charAt(0)}</Text>
                                        </View>
                                        <View>
                                            <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A' }}>{selectedRequest.profiles?.full_name}</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                                <Text style={{ fontSize: 10, fontWeight: '800', color: '#4338CA', backgroundColor: '#E0E7FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, textTransform: 'uppercase' }}>{selectedRequest.role}</Text>
                                                <Text style={{ fontSize: 13, color: '#64748B' }}>{selectedRequest.profiles?.email}</Text>
                                            </View>
                                        </View>
                                    </View>

                                    <View style={{ height: 1, backgroundColor: '#E2E8F0', marginVertical: 16 }} />

                                    <Text style={{ color: '#0F172A', fontSize: 16, fontWeight: '800', marginBottom: 16 }}>Bank Details</Text>
                                    <View style={{ gap: 16 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text style={{ color: '#64748B', fontSize: 14, fontWeight: '500' }}>Bank Name</Text>
                                            <Text style={{ fontWeight: '800', color: '#0F172A', fontSize: 14 }}>{selectedRequest.bank_name}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text style={{ color: '#64748B', fontSize: 14, fontWeight: '500' }}>Account No.</Text>
                                            <Text style={{ fontWeight: '900', color: '#3B82F6', fontSize: 16, letterSpacing: 1, backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 }}>{selectedRequest.account_number}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text style={{ color: '#64748B', fontSize: 14, fontWeight: '500' }}>Account Name</Text>
                                            <Text style={{ fontWeight: '800', color: '#0F172A', fontSize: 14 }}>{selectedRequest.account_name}</Text>
                                        </View>
                                    </View>
                                </View>

                                {selectedRequest.status === 'pending' ? (
                                    <>
                                        <Text style={{ marginBottom: 8, fontWeight: '800', color: '#0F172A', fontSize: 14, paddingHorizontal: 4 }}>Admin Note (Optional)</Text>
                                        <TextInput
                                            style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 16, padding: 16, marginBottom: 24, backgroundColor: '#F8FAFC', fontSize: 15, color: '#0F172A', minHeight: 60 }}
                                            placeholder="e.g. Transaction ID, Rejection Reason..."
                                            placeholderTextColor="#94A3B8"
                                            value={adminNote}
                                            onChangeText={setAdminNote}
                                            multiline
                                        />

                                        <View style={{ flexDirection: 'row', gap: 12 }}>
                                            <TouchableOpacity
                                                onPress={() => processRequest('rejected')}
                                                style={{ flex: 1, paddingVertical: 18, backgroundColor: '#FEF2F2', borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#FECACA' }}
                                            >
                                                <Text style={{ color: '#DC2626', fontWeight: '800', fontSize: 15 }}>Reject & Refund</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => processRequest('paid')}
                                                style={{ flex: 1.5, paddingVertical: 18, backgroundColor: '#0F172A', borderRadius: 16, alignItems: 'center', shadowColor: "#0F172A", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 8 }}
                                            >
                                                <Text style={{ color: 'white', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 }}>Mark as Paid</Text>
                                            </TouchableOpacity>
                                        </View>
                                        <Text style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: '#94A3B8' }}>Take caution: Rejections automatically refund the vendor's wallet.</Text>
                                    </>
                                ) : (
                                    <View style={{ padding: 24, backgroundColor: selectedRequest.status === 'paid' ? '#F0FDF4' : '#FEF2F2', borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: selectedRequest.status === 'paid' ? '#BBF7D0' : '#FECACA' }}>
                                        <Ionicons name={selectedRequest.status === 'paid' ? "checkmark-circle" : "close-circle"} size={48} color={selectedRequest.status === 'paid' ? "#16A34A" : "#DC2626"} style={{ marginBottom: 12 }} />
                                        <Text style={{ color: selectedRequest.status === 'paid' ? '#15803D' : '#B91C1C', fontWeight: '900', fontSize: 18, marginBottom: 8 }}>This request was {selectedRequest.status}.</Text>
                                        {selectedRequest.admin_note ? (
                                            <View style={{ padding: 12, backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 12, width: '100%', marginTop: 8 }}>
                                                <Text style={{ color: '#475569', textAlign: 'center', fontStyle: 'italic', fontSize: 14 }}>"{selectedRequest.admin_note}"</Text>
                                            </View>
                                        ) : null}
                                    </View>
                                )}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
};
