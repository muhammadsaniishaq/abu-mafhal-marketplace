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
                        business_category: 'Shagon Kasuwa',
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
        Alert.alert('Amince Da Mai Kasuwa', `Kana son amincewa da shagon "${app.business_name}"?`, [
            { text: 'A\'a (Cancel)', style: 'cancel' },
            {
                text: 'Amince (Approve)',
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
                            title: 'An Amince Da Shagon Ka! 🎉',
                            message: `Murna! An amince da shagon kasuwancin ka na "${app.business_name}". Yanzu zaka iya shiga shagon ka ka fara sayar da kaya.`,
                            type: 'system',
                            email: vendorEmail
                        }).catch(() => {});

                        // 6. Refresh List
                        Alert.alert('An Amince!', 'An amince da shagon dan kasuwa kuma an daukaka asusun sa.');
                        setView('list');
                        fetchApplications();
                    } catch (err) {
                        Alert.alert('Kuskure', err.message);
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
                title: 'Bayanin Neman Shago',
                message: `Ba a amince da aikace-aikacen shagon ka ba a halin yanzu. Dalili: ${rejectionReason || 'Ba a cika dukkan sharudda ba.'}`,
                type: 'system',
                email: vendorEmail
            }).catch(() => {});

            Alert.alert('An Ƙi', 'An ki amincewa da aikace-aikacen kuma an tura sanarwa.');
            setView('list');
            fetchApplications();
        } catch (err) {
            Alert.alert('Kuskure', err.message || 'An samu matsala wajen kin amincewa.');
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
            <Text style={{ fontWeight: '700', color: NAVY, fontSize: 13 }}>{value || 'Babu'}</Text>
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
            <Text style={{ fontSize: 9.5, color: GOLD, fontWeight: '700', marginTop: 2 }}>Duba Shafi →</Text>
        </TouchableOpacity>
    );

    const renderDetail = () => (
        <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC' }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
            <TouchableOpacity 
                onPress={() => setView('list')} 
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8, alignSelf: 'flex-start', backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' }}
            >
                <Ionicons name="arrow-back" size={18} color={NAVY} />
                <Text style={{ fontSize: 13, fontWeight: '800', color: NAVY }}>Komawa Jerin Yan Kasuwa</Text>
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
            <Section title="Bayanin Mai Asusu (Owner Info)">
                <InfoRow label="Cikakken Suna" value={selectedApp.profiles?.full_name} />
                <InfoRow label="Email" value={selectedApp.profiles?.email} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
                    <Text style={{ color: '#64748B', fontSize: 12.5, fontWeight: '600' }}>Lambar Waya</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontWeight: '700', color: NAVY, fontSize: 13 }}>
                            {selectedApp.phone || selectedApp.profiles?.phone || 'Babu'}
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

            <Section title="Bayanin Kasuwanci (Business Details)">
                <Text style={{ fontSize: 13, color: '#475569', lineHeight: 18, marginBottom: 12 }}>
                    {selectedApp.business_description || 'Babu karin bayani da aka rubuta.'}
                </Text>
                <InfoRow label="Adireshi" value={selectedApp.business_address} />
                <InfoRow label="CAC Number" value={selectedApp.cac_number} />
                <InfoRow label="TIN Number" value={selectedApp.tin_number} />
            </Section>

            <Section title="Asusun Banki (Bank Details)">
                <InfoRow label="Sunan Banki" value={selectedApp.bank_name} />
                <InfoRow label="Lambar Asusu" value={selectedApp.account_number} />
                <InfoRow label="Sunan Asusu" value={selectedApp.account_name} />
            </Section>

            <Section title="Takardun Shaida (Documents)">
                <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                    {selectedApp.nin_url && <DocCard label="NIN Doc" url={selectedApp.nin_url} icon="card-outline" />}
                    {selectedApp.cac_url && <DocCard label="CAC Doc" url={selectedApp.cac_url} icon="business-outline" />}
                    {selectedApp.video_url && <DocCard label="Bidiyon Shago" url={selectedApp.video_url} icon="videocam-outline" color={GOLD} />}
                </View>
            </Section>

            {/* Action Buttons */}
            {selectedApp.status === 'pending' && (
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
                    <TouchableOpacity
                        onPress={() => openRejectModal(selectedApp)}
                        style={{ flex: 1, backgroundColor: '#FEE2E2', padding: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: '#FECACA' }}
                    >
                        <Text style={{ color: '#EF4444', fontWeight: '800', fontSize: 13 }}>Kin Amincewa (Reject)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => handleApprove(selectedApp)}
                        style={{ flex: 2, backgroundColor: NAVY, padding: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: GOLD }}
                    >
                        <Text style={{ color: GOLD, fontWeight: '900', fontSize: 13 }}>Amince Da Shago (Approve)</Text>
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
                    An nemi shiga: {new Date(item.created_at).toLocaleDateString()}
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
                            Yan Kasuwa (Vendors Console)
                        </Text>
                        <Text style={{ color: '#64748B', fontSize: 11.5, marginTop: 2 }}>
                            Duba da sarrafa masu shagunan dake kasuwar Abu Mafhal
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
                                placeholder="Nemi dan kasuwa ta suna, email ko waya..."
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
                                            {st === 'all' ? 'Duka' : st}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {loading && !refreshing ? (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                            <ActivityIndicator size="large" color={GOLD} />
                            <Text style={{ marginTop: 12, fontSize: 12, fontWeight: '700', color: '#64748B' }}>Ana loda yan kasuwa...</Text>
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
                                        Babu dan kasuwa da ya dace da wannan binciken.
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
                        <Text style={{ fontSize: 16, fontWeight: '900', marginBottom: 6, color: NAVY }}>Kin Amincewa Da Shago</Text>
                        <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 14 }}>Rubuta dalilin da yasa ba a amince da wannan shagon ba domin sanar da dan kasuwan.</Text>

                        <TextInput
                            style={{ borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 12, height: 90, textAlignVertical: 'top', marginBottom: 16, backgroundColor: '#F8FAFC', fontSize: 13, color: NAVY }}
                            placeholder="Misali: Takardun shaida ba su bayyana sarai ba..."
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
                                <Text style={{ color: '#64748B', fontWeight: '700' }}>A'a (Cancel)</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={confirmReject}
                                style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: '#EF4444', alignItems: 'center' }}
                            >
                                <Text style={{ color: 'white', fontWeight: '800' }}>Tabbatar da Ƙi</Text>
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
