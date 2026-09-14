import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, Alert, ActivityIndicator, FlatList, RefreshControl, Linking, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { NotificationService } from '../../lib/notifications';
import { WhatsAppActionModal } from '../../components/WhatsAppActionModal';
import { StoreService } from '../../services/storeService';
import * as ImagePicker from 'expo-image-picker';
import { UploadService } from '../../services/uploadService';

const NAVY = '#0E1A2E';
const GOLD = '#D9A73A';

export const AdminVendors = () => {
    const [view, setView] = useState('list'); // 'list' or 'detail'
    const [selectedApp, setSelectedApp] = useState(null);
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'approved', 'rejected', 'recommended'
    const [searchQuery, setSearchQuery] = useState('');

    const [whatsappVisible, setWhatsappVisible] = useState(false);
    const [whatsappPhone, setWhatsappPhone] = useState('');
    const [whatsappUserId, setWhatsappUserId] = useState(null);
    const [whatsappRecipientName, setWhatsappRecipientName] = useState('Vendor');

    const [rejectionModalVisible, setRejectionModalVisible] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [appToReject, setAppToReject] = useState(null);

    // Store Profile Edit Modal State
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingStore, setEditingStore] = useState(null);
    const [editStoreName, setEditStoreName] = useState('');
    const [editAbout, setEditAbout] = useState('');
    const [editCoverImage, setEditCoverImage] = useState('');
    const [editLogoUrl, setEditLogoUrl] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editCategory, setEditCategory] = useState('');
    const [editAddress, setEditAddress] = useState('');
    const [editIsRecommended, setEditIsRecommended] = useState(false);
    const [savingStore, setSavingStore] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);

    useEffect(() => {
        fetchApplications();
    }, []);

    const fetchApplications = async () => {
        try {
            setLoading(true);
            const localCache = await StoreService.getLocalMetadataCache();

            // 1. Fetch real merchant and admin profiles
            const { data: allProfiles, error: profError } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            // 2. Fetch applications if table exists
            let appData = [];
            try {
                const { data, error } = await supabase
                    .from('vendor_applications')
                    .select('*, profiles(email, full_name, phone, avatar_url)')
                    .order('created_at', { ascending: false })
                    .limit(100);
                if (!error && Array.isArray(data)) appData = data;
            } catch (_) {}

            const storesList = [];

            // Add real merchant profiles
            if (allProfiles && Array.isArray(allProfiles)) {
                allProfiles.forEach(p => {
                    const isStore = p.role === 'admin' || p.role === 'vendor' || (typeof p.business_name === 'string' && p.business_name.trim().length > 0);
                    if (!isStore) return;

                    const local = localCache[p.id] || {};
                    let addrMeta = null;
                    if (p.address && p.address.startsWith('{')) {
                        try { addrMeta = JSON.parse(p.address); } catch (_) {}
                    }

                    const isOfficial = p.role === 'admin';
                    const isRec = p.is_recommended !== undefined ? !!p.is_recommended : (addrMeta?.is_recommended || local.is_recommended || isOfficial);

                    storesList.push({
                        id: p.id,
                        user_id: p.id,
                        business_name: p.business_name || (isOfficial ? 'Abu Mafhal Official Store' : (p.full_name || 'Merchant Store')),
                        business_category: p.business_category || addrMeta?.category || (isOfficial ? 'Official Mall & Flagship Store' : 'General Merchant'),
                        business_address: addrMeta?.address || p.address || p.state || 'Nigeria',
                        phone: p.phone || p.phone_number || '2349021486162',
                        about: p.about || addrMeta?.about || local.about || '',
                        cover_image: p.cover_image || addrMeta?.cover_image || local.cover_image || '',
                        logo_url: p.avatar_url || local.logo || null,
                        is_recommended: !!isRec,
                        is_official: isOfficial,
                        status: p.suspended ? 'rejected' : 'approved',
                        created_at: p.created_at,
                        profiles: {
                            full_name: p.full_name,
                            email: p.email,
                            phone: p.phone || p.phone_number,
                            avatar_url: p.avatar_url
                        }
                    });
                });
            }

            // Also merge any pending applications that aren't yet active stores
            appData.forEach(app => {
                const alreadyAdded = storesList.some(s => s.user_id === app.user_id);
                if (!alreadyAdded) {
                    storesList.push({
                        ...app,
                        user_id: app.user_id || app.id,
                        is_recommended: false,
                        is_official: false
                    });
                }
            });

            setApplications(storesList);
        } catch (err) {
            console.error('AdminVendors fetch error:', err);
            setApplications([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleToggleRecommended = async (item) => {
        try {
            const nextState = !item.is_recommended;
            await StoreService.toggleRecommendedVendor(item.user_id || item.id, nextState);
            setApplications(prev => prev.map(a => (a.id === item.id ? { ...a, is_recommended: nextState } : a)));
            if (selectedApp?.id === item.id) {
                setSelectedApp(prev => ({ ...prev, is_recommended: nextState }));
            }
            Alert.alert('Recommended Vendors', nextState ? `Marked "${item.business_name}" as Recommended!` : `Removed "${item.business_name}" from Recommended.`);
        } catch (err) {
            Alert.alert('Error', 'Failed to toggle recommendation: ' + err.message);
        }
    };

    const openEditStoreModal = (app) => {
        setEditingStore(app);
        setEditStoreName(app.business_name || '');
        setEditAbout(app.about || '');
        setEditCoverImage(app.cover_image || '');
        setEditLogoUrl(app.logo_url || app.profiles?.avatar_url || '');
        setEditPhone(app.phone || app.profiles?.phone || '');
        setEditCategory(app.business_category || 'General Merchant');
        setEditAddress(app.business_address || '');
        setEditIsRecommended(!!app.is_recommended);
        setEditModalVisible(true);
    };

    const handlePickImageForStore = async (type) => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Please grant photo gallery permission.');
                return;
            }
            const res = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: type === 'banner' ? [16, 7] : [1, 1],
                quality: 0.8
            });
            if (!res.canceled && res.assets && res.assets[0]) {
                const asset = res.assets[0];
                setUploadingImage(true);
                try {
                    const uploaded = await UploadService.uploadFile(asset, 'vendor-docs', type === 'banner' ? 'covers' : 'logos');
                    if (type === 'banner') setEditCoverImage(uploaded);
                    else setEditLogoUrl(uploaded);
                } catch (_) {
                    if (type === 'banner') setEditCoverImage(asset.uri);
                    else setEditLogoUrl(asset.uri);
                }
            }
        } catch (err) {
            Alert.alert('Error', err.message);
        } finally {
            setUploadingImage(false);
        }
    };

    const handleSaveStoreProfile = async () => {
        if (!editingStore) return;
        if (!editStoreName.trim()) {
            Alert.alert('Validation', 'Please provide a store name.');
            return;
        }

        try {
            setSavingStore(true);
            await StoreService.updateStoreProfile({
                userId: editingStore.user_id || editingStore.id,
                storeName: editStoreName.trim(),
                about: editAbout.trim(),
                coverImage: editCoverImage.trim(),
                logoUrl: editLogoUrl.trim(),
                phone: editPhone.trim(),
                category: editCategory.trim(),
                address: editAddress.trim(),
                isRecommended: editIsRecommended
            });

            Alert.alert('Success', 'Store profile and branding updated successfully!');
            setEditModalVisible(false);
            fetchApplications();
        } catch (err) {
            Alert.alert('Error', err.message || 'Failed to update store.');
        } finally {
            setSavingStore(false);
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
        const matchesStatus = statusFilter === 'all' 
            ? true 
            : (statusFilter === 'recommended' ? !!app.is_recommended : app.status === statusFilter);
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
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <TouchableOpacity 
                    onPress={() => setView('list')} 
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' }}
                >
                    <Ionicons name="arrow-back" size={18} color={NAVY} />
                    <Text style={{ fontSize: 13, fontWeight: '800', color: NAVY }}>Back to List</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => openEditStoreModal(selectedApp)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: NAVY, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: GOLD }}
                >
                    <Ionicons name="create-outline" size={16} color={GOLD} />
                    <Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '800' }}>Edit Store</Text>
                </TouchableOpacity>
            </View>

            {/* Business Profile Card */}
            <View style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 22,
                overflow: 'hidden',
                marginBottom: 20,
                borderWidth: 1,
                borderColor: selectedApp.is_recommended ? GOLD : '#E2E8F0',
                elevation: 2
            }}>
                {/* Cover Banner */}
                <View style={{ height: 110, backgroundColor: '#CBD5E1', position: 'relative' }}>
                    <Image
                        source={{ uri: selectedApp.cover_image || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=900&auto=format&fit=crop' }}
                        style={{ width: '100%', height: '100%', resizeMode: 'cover' }}
                    />
                    <View style={{ position: 'absolute', top: 10, right: 10, flexDirection: 'row', gap: 6 }}>
                        {selectedApp.is_official && (
                            <View style={{ backgroundColor: NAVY, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: GOLD }}>
                                <Text style={{ color: GOLD, fontSize: 9.5, fontWeight: '900' }}>OFFICIAL MALL</Text>
                            </View>
                        )}
                        {selectedApp.is_recommended && (
                            <View style={{ backgroundColor: GOLD, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                                <Text style={{ color: '#FFFFFF', fontSize: 9.5, fontWeight: '900' }}>⭐ RECOMMENDED</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Profile Header */}
                <View style={{ padding: 16, alignItems: 'center' }}>
                    <View style={{ marginTop: -40, marginBottom: 6 }}>
                        <Image
                            source={{ uri: selectedApp.logo_url || selectedApp.profiles?.avatar_url || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=150' }}
                            style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: '#FFFFFF' }}
                        />
                    </View>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: NAVY }}>{selectedApp.business_name}</Text>
                    <Text style={{ color: GOLD, fontSize: 12, fontWeight: '700', marginTop: 2 }}>{selectedApp.business_category}</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' }}>
                        <StatusBadge status={selectedApp.status} />
                        <TouchableOpacity
                            onPress={() => handleToggleRecommended(selectedApp)}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                                paddingHorizontal: 10,
                                paddingVertical: 4,
                                borderRadius: 10,
                                backgroundColor: selectedApp.is_recommended ? '#FEF3C7' : '#F1F5F9',
                                borderWidth: 1,
                                borderColor: selectedApp.is_recommended ? GOLD : '#CBD5E1'
                            }}
                        >
                            <Ionicons name={selectedApp.is_recommended ? "star" : "star-outline"} size={12} color={selectedApp.is_recommended ? GOLD : "#64748B"} />
                            <Text style={{ fontSize: 10, fontWeight: '800', color: selectedApp.is_recommended ? GOLD : "#64748B" }}>
                                {selectedApp.is_recommended ? "RECOMMENDED" : "RECOMMEND"}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* About Store Section */}
            <Section title="About This Store (Customer Bio)">
                <Text style={{ fontSize: 13, color: '#334155', lineHeight: 19 }}>
                    {selectedApp.about || 'No custom store description provided yet. Click "Edit Store" to write one.'}
                </Text>
            </Section>

            {/* Owner Information */}
            <Section title="Owner Information">
                <InfoRow label="Full Name" value={selectedApp.profiles?.full_name} />
                <InfoRow label="Email" value={selectedApp.profiles?.email} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
                    <Text style={{ color: '#64748B', fontSize: 12.5, fontWeight: '600' }}>Phone / WhatsApp</Text>
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
                <InfoRow label="Store Location" value={selectedApp.business_address} />
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
        <View
            style={{
                padding: 14,
                backgroundColor: '#FFFFFF',
                marginBottom: 12,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: item.is_recommended ? GOLD : '#E2E8F0',
                shadowColor: NAVY,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 5,
                elevation: 1
            }}
        >
            <TouchableOpacity
                onPress={() => { setSelectedApp(item); setView('detail'); }}
                style={{ flexDirection: 'row', alignItems: 'center' }}
            >
                <Image
                    source={{ uri: item.logo_url || item.profiles?.avatar_url || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=150' }}
                    style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: item.is_recommended ? GOLD : '#CBD5E1' }}
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontWeight: '800', color: NAVY, fontSize: 14 }} numberOfLines={1}>
                            {item.business_name}
                        </Text>
                        {item.is_recommended && (
                            <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: GOLD }}>
                                <Text style={{ fontSize: 9, fontWeight: '800', color: GOLD }}>⭐ RECOMMENDED</Text>
                            </View>
                        )}
                    </View>
                    <Text style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>{item.business_category}</Text>
                    <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
                        Phone: {item.phone || 'None'} • {item.is_official ? 'Official Store' : 'Vendor'}
                    </Text>
                </View>
                <StatusBadge status={item.status} />
            </TouchableOpacity>

            {/* Quick Action Dock */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                <TouchableOpacity
                    onPress={() => handleToggleRecommended(item)}
                    style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        paddingVertical: 7,
                        borderRadius: 10,
                        backgroundColor: item.is_recommended ? '#FEF3C7' : '#F8FAFC',
                        borderWidth: 1,
                        borderColor: item.is_recommended ? GOLD : '#E2E8F0'
                    }}
                >
                    <Ionicons name={item.is_recommended ? "star" : "star-outline"} size={13} color={item.is_recommended ? GOLD : "#64748B"} />
                    <Text style={{ fontSize: 11, fontWeight: '800', color: item.is_recommended ? GOLD : '#475569' }}>
                        {item.is_recommended ? "Recommended" : "Recommend"}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => openEditStoreModal(item)}
                    style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        paddingVertical: 7,
                        borderRadius: 10,
                        backgroundColor: NAVY,
                        borderWidth: 1,
                        borderColor: GOLD + '60'
                    }}
                >
                    <Ionicons name="create-outline" size={13} color={GOLD} />
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#FFFFFF' }}>
                        Edit Profile
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
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
                            Vendors & Stores Console
                        </Text>
                        <Text style={{ color: '#64748B', fontSize: 11.5, marginTop: 2 }}>
                            Manage real merchant stores, branding, and recommended vendors
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
                                placeholder="Search store by name, category, phone..."
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

                        {/* Status & Recommendation Filter Pills */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 12 }}>
                            {['all', 'recommended', 'approved', 'pending', 'rejected'].map(st => {
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
                                            {st === 'recommended' ? '⭐ Recommended' : (st === 'all' ? 'All Stores' : st)}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {loading && !refreshing ? (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                            <ActivityIndicator size="large" color={GOLD} />
                            <Text style={{ marginTop: 12, fontSize: 12, fontWeight: '700', color: '#64748B' }}>Loading real vendor stores...</Text>
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
                                        No vendors found matching this filter.
                                    </Text>
                                </View>
                            }
                        />
                    )}
                </>
            )}

            {/* Store Profile Edit Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={editModalVisible}
                onRequestClose={() => setEditModalVisible(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(14, 26, 46, 0.7)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                            <Text style={{ fontSize: 17, fontWeight: '900', color: NAVY }}>Edit Store Profile & Branding</Text>
                            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                                <Ionicons name="close" size={22} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: NAVY, marginBottom: 4 }}>Store Name</Text>
                            <TextInput
                                style={{ borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 10, marginBottom: 12, fontSize: 13, backgroundColor: '#F8FAFC' }}
                                value={editStoreName}
                                onChangeText={setEditStoreName}
                                placeholder="Store name..."
                            />

                            <Text style={{ fontSize: 12, fontWeight: '700', color: NAVY, marginBottom: 4 }}>Category</Text>
                            <TextInput
                                style={{ borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 10, marginBottom: 12, fontSize: 13, backgroundColor: '#F8FAFC' }}
                                value={editCategory}
                                onChangeText={setEditCategory}
                                placeholder="Business category..."
                            />

                            <Text style={{ fontSize: 12, fontWeight: '700', color: NAVY, marginBottom: 4 }}>About Your Store / Bio</Text>
                            <TextInput
                                style={{ borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 10, height: 75, textAlignVertical: 'top', marginBottom: 12, fontSize: 13, backgroundColor: '#F8FAFC' }}
                                value={editAbout}
                                onChangeText={setEditAbout}
                                placeholder="Describe store goods, warranty, delivery..."
                                multiline
                            />

                            <Text style={{ fontSize: 12, fontWeight: '700', color: NAVY, marginBottom: 4 }}>Cover Banner Image</Text>
                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                                <TouchableOpacity
                                    onPress={() => handlePickImageForStore('banner')}
                                    style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' }}
                                >
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: NAVY }}>Upload Banner</Text>
                                </TouchableOpacity>
                            </View>
                            <TextInput
                                style={{ borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 10, marginBottom: 12, fontSize: 12, backgroundColor: '#F8FAFC' }}
                                value={editCoverImage}
                                onChangeText={setEditCoverImage}
                                placeholder="Or paste banner image URL..."
                            />

                            <Text style={{ fontSize: 12, fontWeight: '700', color: NAVY, marginBottom: 4 }}>Store Logo</Text>
                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                                <TouchableOpacity
                                    onPress={() => handlePickImageForStore('logo')}
                                    style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' }}
                                >
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: NAVY }}>Upload Logo</Text>
                                </TouchableOpacity>
                            </View>
                            <TextInput
                                style={{ borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 10, marginBottom: 12, fontSize: 12, backgroundColor: '#F8FAFC' }}
                                value={editLogoUrl}
                                onChangeText={setEditLogoUrl}
                                placeholder="Or paste logo image URL..."
                            />

                            <Text style={{ fontSize: 12, fontWeight: '700', color: NAVY, marginBottom: 4 }}>Phone / WhatsApp</Text>
                            <TextInput
                                style={{ borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 10, marginBottom: 12, fontSize: 13, backgroundColor: '#F8FAFC' }}
                                value={editPhone}
                                onChangeText={setEditPhone}
                                placeholder="Contact phone..."
                                keyboardType="phone-pad"
                            />

                            <Text style={{ fontSize: 12, fontWeight: '700', color: NAVY, marginBottom: 4 }}>Store Address</Text>
                            <TextInput
                                style={{ borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 10, marginBottom: 16, fontSize: 13, backgroundColor: '#F8FAFC' }}
                                value={editAddress}
                                onChangeText={setEditAddress}
                                placeholder="Physical location..."
                            />

                            {/* Recommended Toggle */}
                            <TouchableOpacity
                                onPress={() => setEditIsRecommended(!editIsRecommended)}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: 12,
                                    backgroundColor: editIsRecommended ? '#FEF3C7' : '#F8FAFC',
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: editIsRecommended ? GOLD : '#E2E8F0',
                                    marginBottom: 16
                                }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Ionicons name={editIsRecommended ? "star" : "star-outline"} size={18} color={editIsRecommended ? GOLD : "#64748B"} />
                                    <View>
                                        <Text style={{ fontSize: 13, fontWeight: '800', color: NAVY }}>Recommended Vendor</Text>
                                        <Text style={{ fontSize: 11, color: '#64748B' }}>Feature this store prominently in customer directory</Text>
                                    </View>
                                </View>
                                <Ionicons
                                    name={editIsRecommended ? "checkbox" : "square-outline"}
                                    size={22}
                                    color={editIsRecommended ? GOLD : "#94A3B8"}
                                />
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleSaveStoreProfile}
                                disabled={savingStore}
                                style={{
                                    backgroundColor: NAVY,
                                    padding: 14,
                                    borderRadius: 14,
                                    alignItems: 'center',
                                    borderWidth: 1,
                                    borderColor: GOLD
                                }}
                            >
                                {savingStore ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>Save Store Changes</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

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
