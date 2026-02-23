import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, Alert, ActivityIndicator, FlatList, RefreshControl, Linking, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { styles } from '../../styles/theme';
import { NotificationService } from '../../lib/notifications';

export const AdminVendors = () => {
    const [view, setView] = useState('list'); // 'list' or 'detail'
    const [selectedApp, setSelectedApp] = useState(null);
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchApplications();
    }, []);

    const fetchApplications = async () => {
        try {
            setLoading(true);
            console.log('AdminVendors: Fetching applications...');
            const { data, error } = await supabase
                .from('vendor_applications')
                .select('*, profiles(email, full_name)')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('AdminVendors Fetch Error:', error);
                Alert.alert('Error', `Failed to fetch applications: ${error.message}`);
                setApplications([]);
            } else {
                setApplications(data || []);
            }
        } catch (err) {
            console.error('AdminVendors Crash Error:', err);
            Alert.alert('Error', 'An unexpected error occurred while fetching.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleApprove = async (app) => {
        Alert.alert('Approve Vendor', `Confirm approval for ${app.business_name}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Approve',
                onPress: async () => {
                    setLoading(true);
                    try {
                        // 1. Update Application Status
                        const { error: appError } = await supabase
                            .from('vendor_applications')
                            .update({ status: 'approved' })
                            .eq('id', app.id);

                        if (appError) throw new Error("App Update Failed: " + appError.message);

                        // 2. [FIX] Update 'vendors' table to Active
                        // We need to ensure the vendor record exists and is active
                        const { error: vendorError } = await supabase
                            .from('vendors')
                            .update({
                                vendor_status: 'active',
                                is_locked: false,
                                is_active: true // Just in case
                            })
                            .eq('user_id', app.user_id);

                        if (vendorError) {
                            console.log('Vendor Table Update Error (Non-fatal):', vendorError);
                            // It might be non-fatal if they don't have a vendor row yet, but they should from registration
                        }

                        // 3. [FIX] Update 'users' table Role to 'vendor' (if not already)
                        const { error: userError } = await supabase
                            .from('users')
                            .update({ role: 'vendor' })
                            .eq('id', app.user_id);

                        if (userError) console.log('User Role Update Error:', userError);

                        // 4. Send Notification (In-App + Email)
                        const vendorEmail = app.profiles?.email;
                        console.log('Sending Approval Notification to:', vendorEmail);

                        await NotificationService.send({
                            userId: app.user_id,
                            title: 'Application Approved! 🎉',
                            message: `Congratulations! Your vendor application for ${app.business_name} has been approved. You can now log in and start selling.`,
                            type: 'system',
                            email: vendorEmail
                        });

                        // 5. Refresh List
                        Alert.alert('Success', 'Vendor application approved & account activated.');
                        setView('list');
                        fetchApplications();
                    } catch (err) {
                        Alert.alert('Error', err.message);
                    } finally {
                        setLoading(false);
                    }
                }
            }
        ]);
    };

    const [rejectionModalVisible, setRejectionModalVisible] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [appToReject, setAppToReject] = useState(null);

    const openRejectModal = (app) => {
        setAppToReject(app);
        setRejectionReason('');
        setRejectionModalVisible(true);
    };

    // ... (Moved to top)

    // ...

    const confirmReject = async () => {
        if (!appToReject) return;

        try {
            setLoading(true);
            console.log('Rejecting App:', appToReject.id);

            const { error } = await supabase
                .from('vendor_applications')
                .update({
                    status: 'rejected',
                    rejection_reason: rejectionReason
                })
                .eq('id', appToReject.id);

            if (error) throw error;

            // [NEW] Send Notification (In-App + Email)
            const vendorEmail = appToReject.profiles?.email;
            console.log('Sending Rejection Notification to:', vendorEmail);

            await NotificationService.send({
                userId: appToReject.user_id,
                title: 'Application Rejected',
                message: `Your vendor application was rejected. Reason: ${rejectionReason}`,
                type: 'system',
                email: vendorEmail // This triggers the email inside the service
            });

            Alert.alert('Success', 'Application rejected and notification sent.');
            setView('list');
            fetchApplications();

        } catch (err) {
            console.error('Reject Error:', err);
            Alert.alert('Error', err.message || 'Failed to reject application');
        } finally {
            setLoading(false);
            setRejectionModalVisible(false);
        }
    };

    const StatusBadge = ({ status }) => {
        let color = '#64748B';
        let bg = '#F1F5F9';
        if (status === 'approved') { color = '#10B981'; bg = '#DCFCE7'; }
        if (status === 'pending') { color = '#F59E0B'; bg = '#FEF3C7'; }
        if (status === 'rejected') { color = '#EF4444'; bg = '#FEE2E2'; }

        return (
            <View style={{ backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: color, textTransform: 'uppercase' }}>{status}</Text>
            </View>
        );
    };

    const renderDetail = () => (
        <ScrollView style={{ flex: 1, backgroundColor: 'white' }}>
            <View style={{ padding: 20 }}>
                <TouchableOpacity onPress={() => setView('list')} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                    <Ionicons name="arrow-back" size={24} color="#0F172A" />
                    <Text style={{ marginLeft: 10, fontSize: 18, fontWeight: '700' }}>Review Application</Text>
                </TouchableOpacity>

                {/* Business Profile */}
                <View style={{ alignItems: 'center', marginBottom: 24 }}>
                    <Image
                        source={{ uri: selectedApp.logo_url || 'https://placehold.co/150' }}
                        style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: '#F8FAFC' }}
                    />
                    <Text style={{ fontSize: 24, fontWeight: '800', marginTop: 12 }}>{selectedApp.business_name}</Text>
                    <Text style={{ color: '#64748B' }}>{selectedApp.business_category}</Text>
                    <View style={{ marginTop: 8 }}>
                        <StatusBadge status={selectedApp.status} />
                    </View>
                </View>

                {/* Detail Sections */}
                <View style={{ gap: 24 }}>
                    <Section title="Owner Info">
                        <InfoRow label="Full Name" value={selectedApp.profiles?.full_name} />
                        <InfoRow label="Email" value={selectedApp.profiles?.email} />
                        <InfoRow label="NIN" value={selectedApp.nin} />
                        <InfoRow label="BVN" value={selectedApp.bvn} />
                    </Section>

                    <Section title="Business Info">
                        <Text style={{ fontSize: 14, color: '#475569', lineHeight: 20, marginBottom: 12 }}>{selectedApp.business_description}</Text>
                        <InfoRow label="Address" value={selectedApp.business_address} />
                        <InfoRow label="CAC Number" value={selectedApp.cac_number} />
                        <InfoRow label="TIN Number" value={selectedApp.tin_number} />
                    </Section>

                    <Section title="Bank Details">
                        <InfoRow label="Bank" value={selectedApp.bank_name} />
                        <InfoRow label="Account Number" value={selectedApp.account_number} />
                        <InfoRow label="Account Name" value={selectedApp.account_name} />
                    </Section>

                    <Section title="Subscription & Payment">
                        <InfoRow label="Plan" value={selectedApp.subscription_plan} />
                        <InfoRow label="Fee" value={selectedApp.subscription_fee ? `₦${selectedApp.subscription_fee.toLocaleString()}` : 'Free'} />
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Text style={{ color: '#64748B', fontSize: 13 }}>Status</Text>
                            <Text style={{ fontWeight: '800', color: selectedApp.payment_status === 'paid' ? '#16A34A' : '#F59E0B', fontSize: 13, textTransform: 'uppercase' }}>
                                {selectedApp.payment_status || 'Pending'}
                            </Text>
                        </View>
                        <InfoRow label="Reference" value={selectedApp.payment_reference} />
                    </Section>

                    <Section title="Documents & Media">
                        <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                            {selectedApp.nin_url && <DocCard label="NIN Doc" url={selectedApp.nin_url} icon="card-outline" />}
                            {selectedApp.cac_url && <DocCard label="CAC Doc" url={selectedApp.cac_url} icon="business-outline" />}
                            {selectedApp.video_url && <DocCard label="Store Video" url={selectedApp.video_url} icon="videocam-outline" color="#3B82F6" />}
                        </View>
                    </Section>
                </View>

                {/* Action Buttons */}
                {selectedApp.status === 'pending' && (
                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 40, marginBottom: 40 }}>
                        <TouchableOpacity
                            onPress={() => openRejectModal(selectedApp)}
                            style={{ flex: 1, backgroundColor: '#FEE2E2', padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#FECACA' }}
                        >
                            <Text style={{ color: '#EF4444', fontWeight: '700' }}>Reject</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => handleApprove(selectedApp)}
                            style={{ flex: 2, backgroundColor: '#0F172A', padding: 16, borderRadius: 12, alignItems: 'center' }}
                        >
                            <Text style={{ color: 'white', fontWeight: '700' }}>Approve Vendor</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </ScrollView>
    );

    const InfoRow = ({ label, value }) => (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ color: '#64748B', fontSize: 13 }}>{label}</Text>
            <Text style={{ fontWeight: '600', color: '#0F172A', fontSize: 13 }}>{value || 'N/A'}</Text>
        </View>
    );

    const Section = ({ title, children }) => (
        <View>
            <Text style={{ fontSize: 12, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1 }}>{title}</Text>
            <View style={{ backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9' }}>
                {children}
            </View>
        </View>
    );

    const DocCard = ({ label, url, icon, color = '#64748B' }) => (
        <TouchableOpacity
            onPress={() => Linking.openURL(url)}
            style={{ padding: 12, backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', minWidth: 100 }}
        >
            <Ionicons name={icon} size={24} color={color} />
            <Text style={{ fontSize: 11, fontWeight: '700', marginTop: 6, color: '#475569' }}>{label}</Text>
        </TouchableOpacity>
    );

    const renderItem = ({ item }) => (
        <TouchableOpacity
            onPress={() => { setSelectedApp(item); setView('detail'); }}
            style={{ flexDirection: 'row', padding: 16, backgroundColor: 'white', marginBottom: 12, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9', alignItems: 'center' }}
        >
            <Image
                source={{ uri: item.logo_url || 'https://placehold.co/100' }}
                style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#F8FAFC' }}
            />
            <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={{ fontWeight: '700', color: '#0F172A', fontSize: 15 }}>{item.business_name}</Text>
                <Text style={{ fontSize: 12, color: '#64748B' }}>{item.business_category}</Text>
                <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Applied {new Date(item.created_at).toLocaleDateString()}</Text>
                <View style={{ marginTop: 4, alignSelf: 'flex-start', backgroundColor: '#F0FDF4', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#DCFCE7' }}>
                    <Text style={{ fontSize: 10, color: '#16A34A', fontWeight: '700', textTransform: 'uppercase' }}>
                        {item.subscription_plan || 'Free'} Plan
                    </Text>
                </View>
            </View>
            <StatusBadge status={item.status} />
        </TouchableOpacity>
    );

    // Move renderItem and other helpers outside if needed, or keep them here.

    // Main Render
    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            {view === 'detail' ? (
                renderDetail()
            ) : (
                <>
                    <View style={{ padding: 20, backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#F1F5F9' }}>
                        <Text style={styles.sectionTitle}>Vendor Applications</Text>
                        <Text style={{ color: '#64748B', fontSize: 13 }}>Review and manage seller requests</Text>
                    </View>

                    {loading && !refreshing ? (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                            <ActivityIndicator size="large" color="#0F172A" />
                        </View>
                    ) : (
                        <FlatList
                            data={applications}
                            keyExtractor={item => item.id}
                            renderItem={renderItem}
                            contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
                            refreshControl={
                                <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchApplications(); }} colors={['#0F172A']} />
                            }
                            ListEmptyComponent={
                                <View style={{ alignItems: 'center', marginTop: 60 }}>
                                    <Ionicons name="storefront-outline" size={48} color="#CBD5E1" />
                                    <Text style={{ color: '#64748B', marginTop: 12 }}>No applications found</Text>
                                </View>
                            }
                        />
                    )}
                </>
            )}

            {/* Rejection Modal - Now always available */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={rejectionModalVisible}
                onRequestClose={() => setRejectionModalVisible(false)}
            >
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <View style={{ width: '85%', backgroundColor: 'white', borderRadius: 20, padding: 20, boxShadow: '0px 4px 10px rgba(0,0,0,0.1)', }}>
                        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12, color: '#0F172A' }}>Reject Application</Text>
                        <Text style={{ fontSize: 14, color: '#64748B', marginBottom: 16 }}>Please provide a reason for rejection. This will be sent to the vendor.</Text>

                        <TextInput
                            style={{ borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 12, height: 100, textAlignVertical: 'top', marginBottom: 20, backgroundColor: '#F8FAFC' }}
                            placeholder="Reason (e.g. Invalid documents)..."
                            multiline
                            value={rejectionReason}
                            onChangeText={setRejectionReason}
                        />

                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity
                                onPress={() => setRejectionModalVisible(false)}
                                style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center' }}
                            >
                                <Text style={{ color: '#64748B', fontWeight: '600' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={confirmReject}
                                style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: '#EF4444', alignItems: 'center' }}
                            >
                                <Text style={{ color: 'white', fontWeight: '600' }}>Reject</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};
