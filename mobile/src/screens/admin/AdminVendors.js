import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, Alert, ActivityIndicator, FlatList, RefreshControl, Linking, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { NotificationService } from '../../lib/notifications';
import { WhatsAppActionModal } from '../../components/WhatsAppActionModal';

const NAVY = '#0E1A2E';
const GOLD = '#D9A73A';

export const AdminVendors = () => {
    const [view, setView] = useState('list'); // 'list' or 'detail'
    const [selectedApp, setSelectedApp] = useState(null);
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'approved', 'rejected'
    const [searchQuery, setSearchQuery] = useState('');

    const [whatsappVisible, setWhatsappVisible] = useState(false);
    const [whatsappPhone, setWhatsappPhone] = useState('');
    const [whatsappUserId, setWhatsappUserId] = useState(null);
    const [whatsappRecipientName, setWhatsappRecipientName] = useState('Vendor');

    const [rejectionModalVisible, setRejectionModalVisible] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [appToReject, setAppToReject] = useState(null);

    useEffect(() => {
        fetchApplications();
    }, []);

    const fetchApplications = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('vendor_applications')
                .select('*, profiles(email, full_name, phone, avatar_url)')
                .order('created_at', { ascending: false })
                .limit(100);

            if (!error && data && data.length > 0) {
                setApplications(data);
            } else {
                // Fallback to real vendors in profiles
                const { data: vendorProfiles, error: profError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('role', 'vendor')
                    .order('created_at', { ascending: false });

                if (!profError && vendorProfiles) {
                    const mapped = vendorProfiles.map(p => ({
                        id: p.id,
                        user_id: p.id,
                        business_name: p.business_name || p.full_name || 'Vendor Store',
                        business_category: 'General Merchant',
                        business_address: p.address || p.state || 'Nigeria',
                        phone: p.phone || p.phone_number,
                        status: p.suspended ? 'rejected' : 'approved',
                        created_at: p.created_at,
                        profiles: {
                            full_name: p.full_name,
                            email: p.email,
                            phone: p.phone || p.phone_number,
                            avatar_url: p.avatar_url
                        }
                    }));
                    setApplications(mapped);
                } else {
                    setApplications([]);
                }
            }
        } catch (err) {
            console.error('AdminVendors fetch error:', err);
            setApplications([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleApprove = async (app) => {
        Alert.alert('Approve Vendor', `Are you sure you want to approve store "${app.business_name}"?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Approve',
                onPress: async () => {
                    setLoading(true);
                    try {
                        // 1. Update Application Status
                        await supabase
                            .from('vendor_applications')
                            .update({ status: 'approved' })
                            .eq('id', app.id);

                        // 2. [CRUCIAL] Update PROFILES table role to 'vendor' so login role works everywhere
                        const { error: profileError } = await supabase
                            .from('profiles')
                            .update({
                                role: 'vendor',
                                business_name: app.business_name || 'Vendor Store',
                                suspended: false
                            })
                            .eq('id', app.user_id);

                        if (profileError) {
                            console.error('Profile role update error:', profileError);
                        }

                        // 3. Update or Upsert VENDORS table to Active
                        const { error: vendorError } = await supabase
                            .from('vendors')
                            .upsert({
                                user_id: app.user_id,
                                business_name: app.business_name || 'Vendor Store',
                                vendor_status: 'active',
                                is_locked: false,
                                is_active: true
                            }, { onConflict: 'user_id' });

                        if (vendorError) {
                            console.log('Vendor Table Update Note:', vendorError);
                        }

                        // 4. Update USERS table role to 'vendor' if present
                        await supabase
                            .from('users')
                            .update({ role: 'vendor' })
                            .eq('id', app.user_id)
                            .catch(() => {});

                        // 5. Send Notification (In-App + Email)
                        const vendorEmail = app.profiles?.email;
                        await NotificationService.send({
                            userId: app.user_id,
                            title: 'Vendor Application Approved! 🎉',
                            message: `Congratulations! Your store application for "${app.business_name}" has been approved. You can now access your vendor dashboard to start selling.`,
                            type: 'system',
                            email: vendorEmail
                        }).catch(() => {});

                        // 6. Refresh List
                        Alert.alert('Approved!', 'Vendor store has been approved and account upgraded successfully.');
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

    const openRejectModal = (app) => {
        setAppToReject(app);
        setRejectionReason('');
        setRejectionModalVisible(true);
    };

    const confirmReject = async () => {
        if (!appToReject) return;

        try {
            setLoading(true);
            await supabase
                .from('vendor_applications')
                .update({
                    status: 'rejected',
                    rejection_reason: rejectionReason
                })
                .eq('id', appToReject.id);

            const vendorEmail = appToReject.profiles?.email;
            await NotificationService.send({
                userId: appToReject.user_id,
                title: 'Vendor Application Update',
                message: `Your store application could not be approved at this time. Reason: ${rejectionReason || 'Requirements not fulfilled.'}`,
                type: 'system',
                email: vendorEmail
            }).catch(() => {});

            Alert.alert('Rejected', 'Vendor application rejected and notification sent.');
            setView('list');
            fetchApplications();
        } catch (err) {
            Alert.alert('Error', err.message || 'Failed to reject application.');
        } finally {
            setLoading(false);
            setRejectionModalVisible(false);
        }
    };

    const StatusBadge = ({ status }) => {
        let color = '#64748B';
        let bg = '#F1F5F9';
        if (status === 'approved') { color = '#10B981'; bg = '#DCFCE7'; }
        if (status === 'pending') { color = GOLD; bg = 'rgba(217, 167, 58, 0.15)'; }
        if (status === 'rejected') { color = '#EF4444'; bg = '#FEE2E2'; }

        return (
            <View style={{ backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: color + '40' }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: color, textTransform: 'uppercase' }}>{status}</Text>
            </View>
        );
    };

    const filteredApplications = applications.filter(app => {
        const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
        const name = (app.business_name || app.profiles?.full_name || '').toLowerCase();
        const email = (app.profiles?.email || '').toLowerCase();
        const phone = (app.phone || app.profiles?.phone || '').toLowerCase();
        const q = searchQuery.toLowerCase();
        const matchesSearch = !q || name.includes(q) || email.includes(q) || phone.includes(q);
        return matchesStatus && matchesSearch;
    });

    const InfoRow = ({ label, value }) => (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' }}>
            <Text style={{ color: '#64748B', fontSize: 12.5, fontWeight: '600' }}>{label}</Text>
            <Text style={{ fontWeight: '700', color: NAVY, fontSize: 13 }}>{value || 'None'}</Text>
        </View>
    );

    const Section = ({ title, children }) => (
        <View style={{ marginBottom: 18 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: GOLD, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.8 }}>
                {title}
            </Text>
            <View style={{ backgroundColor: '#FFFFFF', padding: 16, borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0' }}>
                {children}
            </View>
        </View>
    );

    const DocCard = ({ label, url, icon, color = NAVY }) => (
        <TouchableOpacity
            onPress={() => url && Linking.openURL(url)}
            style={{ padding: 12, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', minWidth: 100, flex: 1 }}
        >
            <Ionicons name={icon} size={22} color={color} />
            <Text style={{ fontSize: 11, fontWeight: '700', marginTop: 6, color: NAVY }}>{label}</Text>
            <Text style={{ fontSize: 9.5, color: GOLD, fontWeight: '700', marginTop: 2 }}>View Document →</Text>
        </TouchableOpacity>
    );

    const renderDetail = () => (
        <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC' }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
            <TouchableOpacity 
                onPress={() => setView('list')} 
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8, alignSelf: 'flex-start', backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' }}
            >
                <Ionicons name="arrow-back" size={18} color={NAVY} />
                <Text style={{ fontSize: 13, fontWeight: '800', color: NAVY }}>Back to Vendors List</Text>
            </TouchableOpacity>

            {/* Business Profile Card */}
            <View style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 22,
                padding: 20,
                alignItems: 'center',
                marginBottom: 20,
                borderWidth: 1,
                borderColor: 'rgba(217, 167, 58, 0.35)',
                shadowColor: NAVY,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 6,
                elevation: 2
            }}>
                <Image
                    source={{ uri: selectedApp.logo_url || selectedApp.profiles?.avatar_url || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=150' }}
                    style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#F8FAFC', borderWidth: 2, borderColor: GOLD }}
                />
                <Text style={{ fontSize: 20, fontWeight: '900', color: NAVY, marginTop: 10 }}>{selectedApp.business_name}</Text>
                <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>{selectedApp.business_category}</Text>
                <View style={{ marginTop: 10 }}>
                    <StatusBadge status={selectedApp.status} />
                </View>
            </View>

            {/* Detail Sections */}
            <Section title="Owner Information">
                <InfoRow label="Full Name" value={selectedApp.profiles?.full_name} />
                <InfoRow label="Email" value={selectedApp.profiles?.email} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
                    <Text style={{ color: '#64748B', fontSize: 12.5, fontWeight: '600' }}>Phone Number</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontWeight: '700', color: NAVY, fontSize: 13 }}>
                            {selectedApp.phone || selectedApp.profiles?.phone || 'None'}
                        </Text>
                        {(selectedApp.phone || selectedApp.profiles?.phone) ? (
                            <TouchableOpacity 
                                onPress={() => {
                                    const rawPhone = selectedApp.phone || selectedApp.profiles?.phone;
                                    setWhatsappPhone(rawPhone);
                                    setWhatsappUserId(selectedApp.user_id || null);
                                    setWhatsappRecipientName(selectedApp.profiles?.full_name || selectedApp.business_name || 'Vendor');
                                    setWhatsappVisible(true);
                                }}
                                style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                            >
                                <Ionicons name="logo-whatsapp" size={13} color="#16A34A" />
                                <Text style={{ fontSize: 11, fontWeight: '800', color: '#16A34A' }}>Chat</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </View>
                <InfoRow label="NIN" value={selectedApp.nin} />
                <InfoRow label="BVN" value={selectedApp.bvn} />
            </Section>

            <Section title="Business Details">
                <Text style={{ fontSize: 13, color: '#475569', lineHeight: 18, marginBottom: 12 }}>
                    {selectedApp.business_description || 'No business description provided.'}
                </Text>
                <InfoRow label="Business Address" value={selectedApp.business_address} />
                <InfoRow label="CAC Number" value={selectedApp.cac_number} />
                <InfoRow label="TIN Number" value={selectedApp.tin_number} />
            </Section>

            <Section title="Bank Details">
                <InfoRow label="Bank Name" value={selectedApp.bank_name} />
                <InfoRow label="Account Number" value={selectedApp.account_number} />
                <InfoRow label="Account Name" value={selectedApp.account_name} />
            </Section>

            <Section title="Verification Documents">
                <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                    {selectedApp.nin_url && <DocCard label="NIN Document" url={selectedApp.nin_url} icon="card-outline" />}
                    {selectedApp.cac_url && <DocCard label="CAC Certificate" url={selectedApp.cac_url} icon="business-outline" />}
                    {selectedApp.video_url && <DocCard label="Store Video" url={selectedApp.video_url} icon="videocam-outline" color={GOLD} />}
                </View>
            </Section>

            {/* Action Buttons */}
            {selectedApp.status === 'pending' && (
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
                    <TouchableOpacity
                        onPress={() => openRejectModal(selectedApp)}
                        style={{ flex: 1, backgroundColor: '#FEE2E2', padding: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: '#FECACA' }}
                    >
                        <Text style={{ color: '#EF4444', fontWeight: '800', fontSize: 13 }}>Reject Application</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => handleApprove(selectedApp)}
                        style={{ flex: 2, backgroundColor: NAVY, padding: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: GOLD }}
                    >
                        <Text style={{ color: GOLD, fontWeight: '900', fontSize: 13 }}>Approve Vendor</Text>
                    </TouchableOpacity>
                </View>
            )}
        </ScrollView>
    );

    const renderItem = ({ item }) => (
        <TouchableOpacity
            onPress={() => { setSelectedApp(item); setView('detail'); }}
            style={{
                flexDirection: 'row',
                padding: 14,
                backgroundColor: '#FFFFFF',
                marginBottom: 10,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: '#E2E8F0',
                alignItems: 'center',
                shadowColor: NAVY,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 5,
                elevation: 1
            }}
        >
            <Image
                source={{ uri: item.logo_url || item.profiles?.avatar_url || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=150' }}
                style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: GOLD }}
            />
            <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontWeight: '800', color: NAVY, fontSize: 14 }} numberOfLines={1}>
                    {item.business_name}
                </Text>
                <Text style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>{item.business_category}</Text>
                <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
                    Applied on: {new Date(item.created_at).toLocaleDateString()}
                </Text>
            </View>
            <StatusBadge status={item.status} />
        </TouchableOpacity>
    );

    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            {view === 'detail' ? (
                renderDetail()
            ) : (
                <>
                    {/* Header & Filter Area */}
                    <View style={{ padding: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#E2E8F0' }}>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: NAVY }}>
                            Vendors Console
                        </Text>
                        <Text style={{ color: '#64748B', fontSize: 11.5, marginTop: 2 }}>
                            Review and manage merchant applications and live stores
                        </Text>

                        {/* Search Bar */}
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: '#F8FAFC',
                            borderRadius: 12,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            marginTop: 12,
                            borderWidth: 1,
                            borderColor: '#E2E8F0'
                        }}>
                            <Ionicons name="search" size={16} color="#94A3B8" />
                            <TextInput
                                placeholder="Search vendor by name, email or phone..."
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                style={{ flex: 1, marginLeft: 8, fontSize: 12.5, color: NAVY }}
                                placeholderTextColor="#94A3B8"
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <Ionicons name="close-circle" size={16} color="#94A3B8" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Status Pills */}
                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
                            {['all', 'pending', 'approved', 'rejected'].map(st => {
                                const active = statusFilter === st;
                                return (
                                    <TouchableOpacity
                                        key={st}
                                        onPress={() => setStatusFilter(st)}
                                        style={{
                                            paddingHorizontal: 12,
                                            paddingVertical: 6,
                                            borderRadius: 10,
                                            backgroundColor: active ? NAVY : '#F1F5F9',
                                            borderWidth: 1,
                                            borderColor: active ? GOLD : 'transparent'
                                        }}
                                    >
                                        <Text style={{
                                            fontSize: 11,
                                            fontWeight: '800',
                                            color: active ? GOLD : '#64748B',
                                            textTransform: 'capitalize'
                                        }}>
                                            {st === 'all' ? 'All' : st}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {loading && !refreshing ? (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                            <ActivityIndicator size="large" color={GOLD} />
                            <Text style={{ marginTop: 12, fontSize: 12, fontWeight: '700', color: '#64748B' }}>Loading vendor applications...</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={filteredApplications}
                            keyExtractor={item => item.id}
                            renderItem={renderItem}
                            contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
                            refreshControl={
                                <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchApplications(); }} colors={[GOLD, NAVY]} />
                            }
                            ListEmptyComponent={
                                <View style={{ alignItems: 'center', marginTop: 40, opacity: 0.7 }}>
                                    <Ionicons name="storefront-outline" size={48} color="#94A3B8" />
                                    <Text style={{ color: '#64748B', marginTop: 10, fontWeight: '700', fontSize: 13 }}>
                                        No vendors found matching this filter or search.
                                    </Text>
                                </View>
                            }
                        />
                    )}
                </>
            )}

            {/* Rejection Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={rejectionModalVisible}
                onRequestClose={() => setRejectionModalVisible(false)}
            >
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(14, 26, 46, 0.6)', padding: 20 }}>
                    <View style={{ width: '100%', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#E2E8F0' }}>
                        <Text style={{ fontSize: 16, fontWeight: '900', marginBottom: 6, color: NAVY }}>Reject Vendor Application</Text>
                        <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 14 }}>Provide a reason for rejection to notify the vendor.</Text>

                        <TextInput
                            style={{ borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 12, height: 90, textAlignVertical: 'top', marginBottom: 16, backgroundColor: '#F8FAFC', fontSize: 13, color: NAVY }}
                            placeholder="e.g. Identity documents not clear or expired..."
                            placeholderTextColor="#94A3B8"
                            multiline
                            value={rejectionReason}
                            onChangeText={setRejectionReason}
                        />

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity
                                onPress={() => setRejectionModalVisible(false)}
                                style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center' }}
                            >
                                <Text style={{ color: '#64748B', fontWeight: '700' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={confirmReject}
                                style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: '#EF4444', alignItems: 'center' }}
                            >
                                <Text style={{ color: 'white', fontWeight: '800' }}>Confirm Rejection</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <WhatsAppActionModal
                visible={whatsappVisible}
                phone={whatsappPhone}
                userId={whatsappUserId}
                recipientName={whatsappRecipientName}
                onClose={() => setWhatsappVisible(false)}
            />
        </View>
    );
};
