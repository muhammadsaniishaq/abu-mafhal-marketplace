import React, { useState, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, Image, ScrollView, Alert,
    ActivityIndicator, FlatList, RefreshControl, Linking, Modal,
    TextInput, StyleSheet, Platform, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { NotificationService } from '../../lib/notifications';
import { WhatsAppActionModal } from '../../components/WhatsAppActionModal';
import { StoreService } from '../../services/storeService';
import * as ImagePicker from 'expo-image-picker';
import { UploadService } from '../../services/uploadService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

// ─── Pristine Modern Color System (Clean, Structured, Airy) ─────────────────
const C = {
    canvas: '#F8FAFC',          // Slate-50 clean canvas
    cardBg: '#FFFFFF',          // Pure white card
    border: '#E2E8F0',          // Slate-200 border
    borderLight: '#F1F5F9',     // Slate-100 separator
    dark: '#0F172A',            // Slate-900 typography
    body: '#334155',            // Slate-700 typography
    muted: '#64748B',           // Slate-500 secondary
    subtle: '#94A3B8',          // Slate-400 placeholder
    gold: '#D97706',            // Amber-600 gold
    goldBg: '#FEF3C7',
    goldBorder: '#FDE68A',
    emerald: '#059669',         // Emerald-600
    emeraldBg: '#ECFDF5',
    emeraldBorder: '#A7F3D0',
    rose: '#E11D48',            // Rose-600
    roseBg: '#FFF1F2',
    roseBorder: '#FECDD3',
    blue: '#2563EB',            // Blue-600
    blueBg: '#EFF6FF',
    blueBorder: '#BFDBFE',
};

export const AdminVendors = () => {
    const insets = useSafeAreaInsets();
    const [view, setView] = useState('list'); // 'list' | 'detail'
    const [selectedApp, setSelectedApp] = useState(null);
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'verified', 'recommended', 'pending', 'rejected'
    const [searchQuery, setSearchQuery] = useState('');

    // WhatsApp Modal
    const [whatsappVisible, setWhatsappVisible] = useState(false);
    const [whatsappPhone, setWhatsappPhone] = useState('');
    const [whatsappUserId, setWhatsappUserId] = useState(null);
    const [whatsappRecipientName, setWhatsappRecipientName] = useState('Vendor');

    // Reject Modal
    const [rejectionModalVisible, setRejectionModalVisible] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [appToReject, setAppToReject] = useState(null);

    // Edit Store Modal
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingStore, setEditingStore] = useState(null);
    const [editStoreName, setEditStoreName] = useState('');
    const [editTagline, setEditTagline] = useState('');
    const [editAbout, setEditAbout] = useState('');
    const [editCoverImage, setEditCoverImage] = useState('');
    const [editLogoUrl, setEditLogoUrl] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editCategory, setEditCategory] = useState('');
    const [editAddress, setEditAddress] = useState('');
    const [editIsRecommended, setEditIsRecommended] = useState(false);
    const [editIsVerified, setEditIsVerified] = useState(false);
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
                    const isVerified = isOfficial
                        ? true
                        : (p.is_verified !== undefined
                            ? !!p.is_verified
                            : (addrMeta?.is_verified !== undefined
                                ? !!addrMeta.is_verified
                                : (local.is_verified !== undefined ? !!local.is_verified : !!p.vendor_approved)));
                    const tagline = p.tagline || addrMeta?.tagline || local.tagline || (isOfficial ? 'Abu Mafhal Official Store' : (isVerified ? 'Verified Merchant on Abu Mafhal' : 'Merchant on Abu Mafhal'));

                    storesList.push({
                        id: p.id,
                        user_id: p.id,
                        business_name: p.business_name || (isOfficial ? 'Abu Mafhal Official Store' : (p.full_name || 'Merchant Store')),
                        tagline: tagline,
                        business_category: p.business_category || addrMeta?.category || (isOfficial ? 'Official Mall & Flagship' : 'General Merchant'),
                        business_address: addrMeta?.address || p.address || p.state || 'Nigeria',
                        phone: p.phone || p.phone_number || '',
                        about: p.about || addrMeta?.about || local.about || '',
                        cover_image: p.cover_image || addrMeta?.cover_image || local.cover_image || '',
                        logo_url: p.avatar_url || local.logo || null,
                        is_recommended: !!isRec,
                        is_verified: isVerified,
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

            // Merge pending applications
            appData.forEach(app => {
                const alreadyAdded = storesList.some(s => s.user_id === app.user_id);
                if (!alreadyAdded) {
                    storesList.push({
                        ...app,
                        user_id: app.user_id || app.id,
                        tagline: app.tagline || 'Merchant Applicant',
                        is_recommended: false,
                        is_verified: false,
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

    // KPI Metrics Computation
    const stats = React.useMemo(() => {
        return {
            total: applications.length,
            verified: applications.filter(a => a.is_verified).length,
            recommended: applications.filter(a => a.is_recommended).length,
            pending: applications.filter(a => a.status === 'pending').length,
        };
    }, [applications]);

    const handleToggleRecommended = async (item) => {
        try {
            const nextState = !item.is_recommended;
            await StoreService.toggleRecommendedVendor(item.user_id || item.id, nextState);
            setApplications(prev => prev.map(a => (a.id === item.id ? { ...a, is_recommended: nextState } : a)));
            if (selectedApp?.id === item.id) {
                setSelectedApp(prev => ({ ...prev, is_recommended: nextState }));
            }
            Alert.alert('Featured Status', nextState ? `"${item.business_name}" is now Recommended on homepage!` : `Removed "${item.business_name}" from Recommended.`);
        } catch (err) {
            Alert.alert('Error', 'Failed to toggle recommendation: ' + err.message);
        }
    };

    const handleToggleVerified = async (item) => {
        try {
            const nextState = !item.is_verified;
            await StoreService.toggleVerifiedVendor(item.user_id || item.id, nextState);
            setApplications(prev => prev.map(a => (a.id === item.id ? { ...a, is_verified: nextState } : a)));
            if (selectedApp?.id === item.id) {
                setSelectedApp(prev => ({ ...prev, is_verified: nextState }));
            }
            Alert.alert(
                'Verification',
                nextState
                    ? `Verified "${item.business_name}"! Green checkmark badge is active.`
                    : `Revoked verification badge for "${item.business_name}".`
            );
        } catch (err) {
            Alert.alert('Error', 'Failed to update verification: ' + err.message);
        }
    };

    const openEditStoreModal = (app) => {
        setEditingStore(app);
        setEditStoreName(app.business_name || '');
        setEditTagline(app.tagline || '');
        setEditAbout(app.about || '');
        setEditCoverImage(app.cover_image || '');
        setEditLogoUrl(app.logo_url || app.profiles?.avatar_url || '');
        setEditPhone(app.phone || app.profiles?.phone || '');
        setEditCategory(app.business_category || 'General Merchant');
        setEditAddress(app.business_address || '');
        setEditIsRecommended(!!app.is_recommended);
        setEditIsVerified(!!app.is_verified);
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
                tagline: editTagline.trim(),
                about: editAbout.trim(),
                coverImage: editCoverImage.trim(),
                logoUrl: editLogoUrl.trim(),
                phone: editPhone.trim(),
                category: editCategory.trim(),
                address: editAddress.trim(),
                isRecommended: editIsRecommended,
                isVerified: editIsVerified
            });

            Alert.alert('Saved', 'Store profile and branding updated successfully!');
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
                        await supabase
                            .from('vendor_applications')
                            .update({ status: 'approved' })
                            .eq('id', app.id);

                        await supabase
                            .from('profiles')
                            .update({
                                role: 'vendor',
                                business_name: app.business_name || 'Vendor Store',
                                suspended: false,
                                is_verified: true,
                                vendor_approved: true,
                                tagline: app.tagline || 'Verified Merchant on Abu Mafhal'
                            })
                            .eq('id', app.user_id);

                        await supabase
                            .from('vendors')
                            .upsert({
                                user_id: app.user_id,
                                business_name: app.business_name || 'Vendor Store',
                                vendor_status: 'active',
                                is_locked: false,
                                is_active: true,
                                is_verified: true
                            }, { onConflict: 'user_id' });

                        await StoreService.updateStoreProfile({
                            userId: app.user_id,
                            storeName: app.business_name || 'Vendor Store',
                            tagline: app.tagline || 'Verified Merchant on Abu Mafhal',
                            isVerified: true
                        }).catch(() => {});

                        const vendorEmail = app.profiles?.email;
                        await NotificationService.send({
                            userId: app.user_id,
                            title: 'Vendor Store Approved! 🎉',
                            message: `Congratulations! Your store application for "${app.business_name}" has been approved. You can now access your vendor console.`,
                            type: 'system',
                            email: vendorEmail
                        }).catch(() => {});

                        Alert.alert('Approved!', 'Vendor store approved and permissions activated.');
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

            Alert.alert('Rejected', 'Application status updated.');
            setView('list');
            fetchApplications();
        } catch (err) {
            Alert.alert('Error', err.message || 'Failed to reject application.');
        } finally {
            setLoading(false);
            setRejectionModalVisible(false);
        }
    };

    const filteredApplications = applications.filter(app => {
        const matchesStatus = statusFilter === 'all' 
            ? true 
            : (statusFilter === 'recommended' 
                ? !!app.is_recommended 
                : (statusFilter === 'verified'
                    ? !!app.is_verified
                    : app.status === statusFilter));
        const name = (app.business_name || app.profiles?.full_name || '').toLowerCase();
        const tagline = (app.tagline || '').toLowerCase();
        const email = (app.profiles?.email || '').toLowerCase();
        const phone = (app.phone || app.profiles?.phone || '').toLowerCase();
        const q = searchQuery.toLowerCase();
        const matchesSearch = !q || name.includes(q) || tagline.includes(q) || email.includes(q) || phone.includes(q);
        return matchesStatus && matchesSearch;
    });

    // ── STORE DETAILS VIEW ──────────────────────────────────────────────────
    const renderDetail = () => {
        if (!selectedApp) return null;
        return (
            <ScrollView style={{ flex: 1, backgroundColor: C.canvas }} contentContainerStyle={{ padding: 14, paddingBottom: 60 }}>
                {/* Back & Edit Action Row */}
                <View style={S.detailTopNav}>
                    <TouchableOpacity 
                        onPress={() => setView('list')} 
                        style={S.backBtn}
                    >
                        <Ionicons name="arrow-back" size={17} color={C.dark} />
                        <Text style={S.backBtnText}>Back to Stores</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => openEditStoreModal(selectedApp)}
                        style={S.editStoreTopBtn}
                    >
                        <Ionicons name="create-outline" size={15} color="#FFFFFF" />
                        <Text style={S.editStoreTopBtnText}>Edit Branding</Text>
                    </TouchableOpacity>
                </View>

                {/* Hero Showcase Card */}
                <View style={S.storeHeroCard}>
                    {/* Cover Banner */}
                    <View style={S.heroBanner}>
                        <Image
                            source={{ uri: selectedApp.cover_image || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=900&auto=format&fit=crop' }}
                            style={S.heroBannerImg}
                        />
                        <View style={S.bannerBadges}>
                            {selectedApp.is_official && (
                                <View style={[S.pillBadge, { backgroundColor: C.dark }]}>
                                    <Text style={[S.pillBadgeTxt, { color: C.gold }]}>OFFICIAL MALL</Text>
                                </View>
                            )}
                            <View style={[S.pillBadge, selectedApp.is_verified ? { backgroundColor: C.emeraldBg } : { backgroundColor: '#F1F5F9' }]}>
                                <Ionicons name={selectedApp.is_verified ? "shield-checkmark" : "shield-outline"} size={10} color={selectedApp.is_verified ? C.emerald : C.muted} />
                                <Text style={[S.pillBadgeTxt, { color: selectedApp.is_verified ? C.emerald : C.muted, marginLeft: 3 }]}>
                                    {selectedApp.is_verified ? 'VERIFIED' : 'UNVERIFIED'}
                                </Text>
                            </View>
                            {selectedApp.is_recommended && (
                                <View style={[S.pillBadge, { backgroundColor: C.goldBg }]}>
                                    <Text style={[S.pillBadgeTxt, { color: C.gold }]}>⭐ FEATURED</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Store Identity Content */}
                    <View style={S.heroBody}>
                        <View style={S.logoFrame}>
                            <Image
                                source={{ uri: selectedApp.logo_url || selectedApp.profiles?.avatar_url || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=150' }}
                                style={S.logoImg}
                            />
                        </View>

                        <Text style={S.heroStoreName}>{selectedApp.business_name}</Text>
                        {selectedApp.tagline ? (
                            <Text style={S.heroTagline}>"{selectedApp.tagline}"</Text>
                        ) : null}
                        <Text style={S.heroCategory}>{selectedApp.business_category}</Text>

                        {/* Interactive Toggles */}
                        <View style={S.heroTogglesRow}>
                            <TouchableOpacity
                                onPress={() => handleToggleVerified(selectedApp)}
                                style={[S.heroToggleBtn, selectedApp.is_verified && { backgroundColor: C.emeraldBg, borderColor: C.emeraldBorder }]}
                            >
                                <Ionicons name={selectedApp.is_verified ? "shield-checkmark" : "shield-outline"} size={13} color={selectedApp.is_verified ? C.emerald : C.muted} />
                                <Text style={[S.heroToggleBtnTxt, selectedApp.is_verified && { color: C.emerald }]}>
                                    {selectedApp.is_verified ? "Verified Merchant" : "Tap to Verify"}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => handleToggleRecommended(selectedApp)}
                                style={[S.heroToggleBtn, selectedApp.is_recommended && { backgroundColor: C.goldBg, borderColor: C.goldBorder }]}
                            >
                                <Ionicons name={selectedApp.is_recommended ? "star" : "star-outline"} size={13} color={selectedApp.is_recommended ? C.gold : C.muted} />
                                <Text style={[S.heroToggleBtnTxt, selectedApp.is_recommended && { color: C.gold }]}>
                                    {selectedApp.is_recommended ? "Featured on Home" : "Tap to Feature"}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Direct Communications Dock */}
                <View style={S.dockCard}>
                    <Text style={S.sectionHeading}>Merchant Communications</Text>
                    <View style={S.dockRow}>
                        {(selectedApp.phone || selectedApp.profiles?.phone) ? (
                            <TouchableOpacity
                                onPress={() => Linking.openURL(`tel:${selectedApp.phone || selectedApp.profiles?.phone}`)}
                                style={S.dockBtn}
                            >
                                <Ionicons name="call-outline" size={15} color={C.dark} />
                                <Text style={S.dockBtnText}>Call</Text>
                            </TouchableOpacity>
                        ) : null}

                        {(selectedApp.phone || selectedApp.profiles?.phone) ? (
                            <TouchableOpacity
                                onPress={() => {
                                    const rawPhone = selectedApp.phone || selectedApp.profiles?.phone;
                                    setWhatsappPhone(rawPhone);
                                    setWhatsappUserId(selectedApp.user_id || null);
                                    setWhatsappRecipientName(selectedApp.profiles?.full_name || selectedApp.business_name || 'Vendor');
                                    setWhatsappVisible(true);
                                }}
                                style={[S.dockBtn, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}
                            >
                                <Ionicons name="logo-whatsapp" size={15} color="#16A34A" />
                                <Text style={[S.dockBtnText, { color: '#16A34A' }]}>WhatsApp</Text>
                            </TouchableOpacity>
                        ) : null}

                        {selectedApp.profiles?.email ? (
                            <TouchableOpacity
                                onPress={() => Linking.openURL(`mailto:${selectedApp.profiles?.email}`)}
                                style={S.dockBtn}
                            >
                                <Ionicons name="mail-outline" size={15} color={C.blue} />
                                <Text style={[S.dockBtnText, { color: C.blue }]}>Email</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </View>

                {/* Store Profile Sections */}
                <View style={S.sectionCard}>
                    <Text style={S.sectionHeading}>Store Promotional Slogan</Text>
                    <Text style={S.sectionBodyText}>
                        {selectedApp.tagline || 'No custom slogan set. Click "Edit Branding" to write one.'}
                    </Text>
                </View>

                <View style={S.sectionCard}>
                    <Text style={S.sectionHeading}>About Store (Customer Bio)</Text>
                    <Text style={[S.sectionBodyText, { lineHeight: 20 }]}>
                        {selectedApp.about || 'No custom store description provided yet.'}
                    </Text>
                </View>

                <View style={S.sectionCard}>
                    <Text style={S.sectionHeading}>Store Ownership & Location</Text>
                    <View style={S.infoItemRow}>
                        <Text style={S.infoItemLbl}>Owner Legal Name</Text>
                        <Text style={S.infoItemVal}>{selectedApp.profiles?.full_name || 'N/A'}</Text>
                    </View>
                    <View style={S.infoItemRow}>
                        <Text style={S.infoItemLbl}>Account Email</Text>
                        <Text style={S.infoItemVal}>{selectedApp.profiles?.email || 'N/A'}</Text>
                    </View>
                    <View style={S.infoItemRow}>
                        <Text style={S.infoItemLbl}>Contact Phone</Text>
                        <Text style={S.infoItemVal}>{selectedApp.phone || selectedApp.profiles?.phone || 'N/A'}</Text>
                    </View>
                    <View style={[S.infoItemRow, { borderBottomWidth: 0 }]}>
                        <Text style={S.infoItemLbl}>Business Location</Text>
                        <Text style={S.infoItemVal}>{selectedApp.business_address || 'Nigeria'}</Text>
                    </View>
                </View>

                {/* Approval Action Bar for Pending Applications */}
                {selectedApp.status === 'pending' && (
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                        <TouchableOpacity
                            onPress={() => openRejectModal(selectedApp)}
                            style={[S.mainBtn, { backgroundColor: C.roseBg, borderColor: C.roseBorder }]}
                        >
                            <Text style={[S.mainBtnText, { color: C.rose }]}>Reject Application</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => handleApprove(selectedApp)}
                            style={[S.mainBtn, { backgroundColor: C.dark, flex: 2 }]}
                        >
                            <Text style={[S.mainBtnText, { color: '#FFFFFF' }]}>Approve Store ✓</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        );
    };

    // ── VENDOR / STORE CARD ITEM ─────────────────────────────────────────────
    const renderItem = ({ item }) => (
        <View style={S.storeCard}>
            <TouchableOpacity
                onPress={() => { setSelectedApp(item); setView('detail'); }}
                style={S.storeCardMainRow}
            >
                {/* Store Logo with Status Indicator */}
                <View style={S.cardLogoWrap}>
                    <Image
                        source={{ uri: item.logo_url || item.profiles?.avatar_url || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=150' }}
                        style={S.cardLogoImg}
                    />
                    {item.is_verified && (
                        <View style={S.cardVerifyDot}>
                            <Ionicons name="checkmark" size={8} color="#FFFFFF" />
                        </View>
                    )}
                </View>

                {/* Info Column */}
                <View style={S.cardInfoCol}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={S.cardStoreTitle} numberOfLines={1}>
                            {item.business_name}
                        </Text>
                        {item.is_official && (
                            <View style={[S.microTag, { backgroundColor: C.dark }]}>
                                <Text style={[S.microTagTxt, { color: C.gold }]}>OFFICIAL</Text>
                            </View>
                        )}
                        {item.is_recommended && (
                            <View style={[S.microTag, { backgroundColor: C.goldBg }]}>
                                <Text style={[S.microTagTxt, { color: C.gold }]}>⭐</Text>
                            </View>
                        )}
                    </View>

                    {item.tagline ? (
                        <Text style={S.cardTagline} numberOfLines={1}>"{item.tagline}"</Text>
                    ) : null}

                    <Text style={S.cardCategory} numberOfLines={1}>
                        {item.business_category} • {item.phone || item.profiles?.phone || 'No phone'}
                    </Text>
                </View>

                {/* Right Status & Arrow */}
                <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                    <View style={[
                        S.statusPill,
                        item.status === 'approved' ? { backgroundColor: C.emeraldBg } :
                        item.status === 'pending' ? { backgroundColor: C.goldBg } :
                        { backgroundColor: C.roseBg }
                    ]}>
                        <Text style={[
                            S.statusPillTxt,
                            item.status === 'approved' ? { color: C.emerald } :
                            item.status === 'pending' ? { color: C.gold } :
                            { color: C.rose }
                        ]}>
                            {item.status?.toUpperCase() || 'APPROVED'}
                        </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={C.subtle} style={{ marginTop: 4 }} />
                </View>
            </TouchableOpacity>

            {/* Quick Action Dock */}
            <View style={S.cardActionsDock}>
                <TouchableOpacity
                    onPress={() => handleToggleVerified(item)}
                    style={[S.cardActionBtn, item.is_verified && { backgroundColor: C.emeraldBg, borderColor: C.emeraldBorder }]}
                >
                    <Ionicons name={item.is_verified ? "shield-checkmark" : "shield-outline"} size={13} color={item.is_verified ? C.emerald : C.muted} />
                    <Text style={[S.cardActionBtnTxt, item.is_verified && { color: C.emerald }]}>
                        {item.is_verified ? "Verified" : "Verify"}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => handleToggleRecommended(item)}
                    style={[S.cardActionBtn, item.is_recommended && { backgroundColor: C.goldBg, borderColor: C.goldBorder }]}
                >
                    <Ionicons name={item.is_recommended ? "star" : "star-outline"} size={13} color={item.is_recommended ? C.gold : C.muted} />
                    <Text style={[S.cardActionBtnTxt, item.is_recommended && { color: C.gold }]}>
                        {item.is_recommended ? "Featured" : "Feature"}
                    </Text>
                </TouchableOpacity>

                {(item.phone || item.profiles?.phone) ? (
                    <TouchableOpacity
                        onPress={() => {
                            const rawPhone = item.phone || item.profiles?.phone;
                            setWhatsappPhone(rawPhone);
                            setWhatsappUserId(item.user_id || null);
                            setWhatsappRecipientName(item.profiles?.full_name || item.business_name || 'Vendor');
                            setWhatsappVisible(true);
                        }}
                        style={[S.cardActionBtn, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}
                    >
                        <Ionicons name="logo-whatsapp" size={13} color="#16A34A" />
                        <Text style={[S.cardActionBtnTxt, { color: '#16A34A' }]}>Chat</Text>
                    </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                    onPress={() => openEditStoreModal(item)}
                    style={[S.cardActionBtn, { backgroundColor: '#F8FAFC' }]}
                >
                    <Ionicons name="create-outline" size={13} color={C.dark} />
                    <Text style={S.cardActionBtnTxt}>Edit</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={S.container}>
            {view === 'detail' ? (
                renderDetail()
            ) : (
                <>
                    {/* Header with Search & KPIs */}
                    <View style={S.header}>
                        <View style={S.headerTopRow}>
                            <View>
                                <Text style={S.headerTitle}>Vendors & Stores</Text>
                                <Text style={S.headerSubtitle}>Manage merchant stores, branding, and verified status</Text>
                            </View>
                        </View>

                        {/* 4 Metric Summary Tiles */}
                        <View style={S.kpiRow}>
                            <View style={S.kpiCard}>
                                <Text style={S.kpiLbl}>Total Stores</Text>
                                <Text style={S.kpiVal}>{stats.total}</Text>
                            </View>
                            <View style={S.kpiCard}>
                                <Text style={S.kpiLbl}>Verified</Text>
                                <Text style={[S.kpiVal, { color: C.emerald }]}>{stats.verified}</Text>
                            </View>
                            <View style={S.kpiCard}>
                                <Text style={S.kpiLbl}>Featured</Text>
                                <Text style={[S.kpiVal, { color: C.gold }]}>{stats.recommended}</Text>
                            </View>
                            <View style={S.kpiCard}>
                                <Text style={S.kpiLbl}>Pending</Text>
                                <Text style={[S.kpiVal, { color: stats.pending > 0 ? C.rose : C.dark }]}>{stats.pending}</Text>
                            </View>
                        </View>

                        {/* Search Bar */}
                        <View style={S.searchBox}>
                            <Ionicons name="search" size={16} color={C.subtle} />
                            <TextInput
                                placeholder="Search store name, category, phone..."
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                style={S.searchInput}
                                placeholderTextColor={C.subtle}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <Ionicons name="close-circle" size={16} color={C.subtle} />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Filter Tabs */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.filterScroll}>
                            {[
                                { id: 'all', label: 'All Stores' },
                                { id: 'verified', label: '🛡️ Verified' },
                                { id: 'recommended', label: '⭐ Featured' },
                                { id: 'pending', label: '⏳ Pending' },
                                { id: 'rejected', label: 'Suspended' }
                            ].map(tab => {
                                const active = statusFilter === tab.id;
                                return (
                                    <TouchableOpacity
                                        key={tab.id}
                                        onPress={() => setStatusFilter(tab.id)}
                                        style={[S.filterPill, active && S.filterPillActive]}
                                    >
                                        <Text style={[S.filterPillTxt, active && S.filterPillTxtActive]}>
                                            {tab.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {/* Stores List */}
                    {loading && !refreshing ? (
                        <View style={S.loadingContainer}>
                            <ActivityIndicator size="large" color={C.dark} />
                            <Text style={S.loadingText}>Loading merchant stores…</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={filteredApplications}
                            keyExtractor={item => item.id}
                            renderItem={renderItem}
                            contentContainerStyle={S.listContent}
                            refreshControl={
                                <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchApplications(); }} colors={[C.dark]} />
                            }
                            ListEmptyComponent={
                                <View style={S.emptyState}>
                                    <Ionicons name="storefront-outline" size={44} color={C.subtle} />
                                    <Text style={S.emptyStateText}>No stores match this filter.</Text>
                                </View>
                            }
                        />
                    )}
                </>
            )}

            {/* ── STORE PROFILE & BRANDING EDIT MODAL ── */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={editModalVisible}
                onRequestClose={() => setEditModalVisible(false)}
            >
                <View style={S.modalOverlay}>
                    <View style={S.modalSheet}>
                        <View style={S.modalHeader}>
                            <Text style={S.modalTitle}>Edit Store Branding</Text>
                            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                                <Ionicons name="close" size={22} color={C.muted} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                            <Text style={S.fieldLabel}>Store Name</Text>
                            <TextInput
                                style={S.modalInput}
                                value={editStoreName}
                                onChangeText={setEditStoreName}
                                placeholder="Store name…"
                                placeholderTextColor={C.subtle}
                            />

                            <Text style={S.fieldLabel}>Store Slogan / Tagline (Admin Controlled)</Text>
                            <TextInput
                                style={S.modalInput}
                                value={editTagline}
                                onChangeText={setEditTagline}
                                placeholder="e.g. Official Electronics & Gadgets Dealer"
                                placeholderTextColor={C.subtle}
                            />

                            <Text style={S.fieldLabel}>Category</Text>
                            <TextInput
                                style={S.modalInput}
                                value={editCategory}
                                onChangeText={setEditCategory}
                                placeholder="e.g. Fashion, Tech, Groceries…"
                                placeholderTextColor={C.subtle}
                            />

                            <Text style={S.fieldLabel}>About Store / Bio</Text>
                            <TextInput
                                style={[S.modalInput, { height: 70, textAlignVertical: 'top' }]}
                                value={editAbout}
                                onChangeText={setEditAbout}
                                placeholder="Describe store products, warranty, delivery…"
                                placeholderTextColor={C.subtle}
                                multiline
                            />

                            <Text style={S.fieldLabel}>Cover Banner Image</Text>
                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                                <TouchableOpacity
                                    onPress={() => handlePickImageForStore('banner')}
                                    style={S.uploadBtn}
                                >
                                    <Ionicons name="image-outline" size={14} color={C.dark} />
                                    <Text style={S.uploadBtnTxt}>Upload Banner</Text>
                                </TouchableOpacity>
                            </View>
                            <TextInput
                                style={S.modalInput}
                                value={editCoverImage}
                                onChangeText={setEditCoverImage}
                                placeholder="Or paste banner image URL…"
                                placeholderTextColor={C.subtle}
                            />

                            <Text style={S.fieldLabel}>Store Logo</Text>
                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                                <TouchableOpacity
                                    onPress={() => handlePickImageForStore('logo')}
                                    style={S.uploadBtn}
                                >
                                    <Ionicons name="image-outline" size={14} color={C.dark} />
                                    <Text style={S.uploadBtnTxt}>Upload Logo</Text>
                                </TouchableOpacity>
                            </View>
                            <TextInput
                                style={S.modalInput}
                                value={editLogoUrl}
                                onChangeText={setEditLogoUrl}
                                placeholder="Or paste logo image URL…"
                                placeholderTextColor={C.subtle}
                            />

                            <Text style={S.fieldLabel}>Phone / WhatsApp</Text>
                            <TextInput
                                style={S.modalInput}
                                value={editPhone}
                                onChangeText={setEditPhone}
                                placeholder="Contact telephone…"
                                placeholderTextColor={C.subtle}
                                keyboardType="phone-pad"
                            />

                            <Text style={S.fieldLabel}>Physical Store Address</Text>
                            <TextInput
                                style={S.modalInput}
                                value={editAddress}
                                onChangeText={setEditAddress}
                                placeholder="Store location / city…"
                                placeholderTextColor={C.subtle}
                            />

                            {/* Switches */}
                            <TouchableOpacity
                                onPress={() => setEditIsVerified(!editIsVerified)}
                                style={[S.switchTile, editIsVerified && { backgroundColor: C.emeraldBg, borderColor: C.emeraldBorder }]}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text style={S.switchTileTitle}>Verified Merchant Badge</Text>
                                    <Text style={S.switchTileSub}>Show official green checkmark on store and products</Text>
                                </View>
                                <Ionicons name={editIsVerified ? "checkbox" : "square-outline"} size={22} color={editIsVerified ? C.emerald : C.subtle} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setEditIsRecommended(!editIsRecommended)}
                                style={[S.switchTile, editIsRecommended && { backgroundColor: C.goldBg, borderColor: C.goldBorder }]}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text style={S.switchTileTitle}>Feature on Homepage</Text>
                                    <Text style={S.switchTileSub}>Display in Recommended Vendors slider</Text>
                                </View>
                                <Ionicons name={editIsRecommended ? "checkbox" : "square-outline"} size={22} color={editIsRecommended ? C.gold : C.subtle} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleSaveStoreProfile}
                                disabled={savingStore}
                                style={S.saveModalBtn}
                            >
                                {savingStore ? (
                                    <ActivityIndicator color="#FFFFFF" size="small" />
                                ) : (
                                    <Text style={S.saveModalBtnTxt}>Save Changes</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Rejection Modal */}
            <Modal visible={rejectionModalVisible} transparent animationType="fade" onRequestClose={() => setRejectionModalVisible(false)}>
                <View style={S.dialogOverlay}>
                    <View style={S.dialogBox}>
                        <Text style={S.dialogTitle}>Reject Application</Text>
                        <Text style={S.dialogSubtitle}>Provide a reason for the applicant:</Text>
                        <TextInput
                            value={rejectionReason}
                            onChangeText={setRejectionReason}
                            placeholder="e.g. Incomplete business documents"
                            placeholderTextColor={C.subtle}
                            style={[S.modalInput, { marginTop: 10, height: 60, textAlignVertical: 'top' }]}
                            multiline
                        />
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                            <TouchableOpacity onPress={() => setRejectionModalVisible(false)} style={S.dialogCancelBtn}>
                                <Text style={S.dialogCancelTxt}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={confirmReject} style={[S.dialogConfirmBtn, { backgroundColor: C.rose }]}>
                                <Text style={S.dialogConfirmTxt}>Confirm Reject</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* WhatsApp Integration Modal */}
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

// ─── Executive Stylesheet ──────────────────────────────────────────────────
const S = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: C.canvas,
    },
    header: {
        backgroundColor: C.cardBg,
        paddingHorizontal: 14,
        paddingTop: 12,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: C.dark,
        letterSpacing: -0.3,
    },
    headerSubtitle: {
        fontSize: 11,
        color: C.muted,
        marginTop: 1,
    },

    // 4 KPI Summary Cards
    kpiRow: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 10,
    },
    kpiCard: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        borderRadius: 9,
        borderWidth: 1,
        borderColor: C.border,
        paddingVertical: 6,
        paddingHorizontal: 6,
        alignItems: 'center',
    },
    kpiLbl: {
        fontSize: 8.5,
        fontWeight: '700',
        color: C.muted,
        textTransform: 'uppercase',
    },
    kpiVal: {
        fontSize: 13,
        fontWeight: '900',
        color: C.dark,
        marginTop: 1,
    },

    // Search Bar
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 7,
        marginTop: 10,
        borderWidth: 1,
        borderColor: C.border,
    },
    searchInput: {
        flex: 1,
        fontSize: 12.5,
        color: C.dark,
        marginLeft: 8,
    },

    // Filter Pills
    filterScroll: {
        gap: 6,
        marginTop: 10,
    },
    filterPill: {
        paddingHorizontal: 11,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: C.border,
    },
    filterPillActive: {
        backgroundColor: C.dark,
        borderColor: C.dark,
    },
    filterPillTxt: {
        fontSize: 11,
        fontWeight: '700',
        color: C.muted,
    },
    filterPillTxtActive: {
        color: '#FFFFFF',
        fontWeight: '800',
    },

    // List Content
    listContent: {
        padding: 12,
        paddingBottom: 40,
    },
    storeCard: {
        backgroundColor: C.cardBg,
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: C.border,
    },
    storeCardMainRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardLogoWrap: {
        position: 'relative',
        width: 44,
        height: 44,
        marginRight: 10,
    },
    cardLogoImg: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: C.border,
    },
    cardVerifyDot: {
        position: 'absolute',
        top: -1,
        right: -1,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: C.emerald,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
    },
    cardInfoCol: {
        flex: 1,
        minWidth: 0,
    },
    cardStoreTitle: {
        fontSize: 13.5,
        fontWeight: '800',
        color: C.dark,
    },
    microTag: {
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
    },
    microTagTxt: {
        fontSize: 8.5,
        fontWeight: '900',
    },
    cardTagline: {
        fontSize: 10.5,
        color: C.gold,
        fontStyle: 'italic',
        fontWeight: '600',
        marginTop: 1,
    },
    cardCategory: {
        fontSize: 10.5,
        color: C.muted,
        marginTop: 2,
    },
    statusPill: {
        paddingHorizontal: 7,
        paddingVertical: 2.5,
        borderRadius: 5,
    },
    statusPillTxt: {
        fontSize: 8.5,
        fontWeight: '900',
    },

    // Card Actions Dock
    cardActionsDock: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 10,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: C.borderLight,
    },
    cardActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: 5.5,
        borderRadius: 7,
        borderWidth: 1,
        borderColor: C.border,
    },
    cardActionBtnTxt: {
        fontSize: 10,
        fontWeight: '800',
        color: C.body,
    },

    // Detail View Styles
    detailTopNav: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: C.cardBg,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: C.border,
    },
    backBtnText: {
        fontSize: 12,
        fontWeight: '800',
        color: C.dark,
    },
    editStoreTopBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: C.dark,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
    },
    editStoreTopBtnText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#FFFFFF',
    },

    // Store Hero Card
    storeHeroCard: {
        backgroundColor: C.cardBg,
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: 12,
    },
    heroBanner: {
        height: 110,
        backgroundColor: '#E2E8F0',
        position: 'relative',
    },
    heroBannerImg: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    bannerBadges: {
        position: 'absolute',
        top: 8,
        right: 8,
        flexDirection: 'row',
        gap: 5,
    },
    pillBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 6,
    },
    pillBadgeTxt: {
        fontSize: 9,
        fontWeight: '900',
    },
    heroBody: {
        padding: 14,
        alignItems: 'center',
    },
    logoFrame: {
        marginTop: -38,
        marginBottom: 6,
    },
    logoImg: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#FFFFFF',
        borderWidth: 3,
        borderColor: '#FFFFFF',
    },
    heroStoreName: {
        fontSize: 16,
        fontWeight: '900',
        color: C.dark,
    },
    heroTagline: {
        fontSize: 11.5,
        color: C.gold,
        fontStyle: 'italic',
        fontWeight: '600',
        marginTop: 2,
        textAlign: 'center',
    },
    heroCategory: {
        fontSize: 11,
        color: C.muted,
        marginTop: 2,
    },
    heroTogglesRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 10,
    },
    heroToggleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 7,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: C.border,
    },
    heroToggleBtnTxt: {
        fontSize: 10.5,
        fontWeight: '800',
        color: C.body,
    },

    // Dock Card
    dockCard: {
        backgroundColor: C.cardBg,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: 10,
    },
    dockRow: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 8,
    },
    dockBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: 7,
        borderRadius: 8,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: C.border,
    },
    dockBtnText: {
        fontSize: 11,
        fontWeight: '800',
        color: C.dark,
    },

    // Sections
    sectionCard: {
        backgroundColor: C.cardBg,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: 10,
    },
    sectionHeading: {
        fontSize: 11,
        fontWeight: '800',
        color: C.dark,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
        marginBottom: 6,
    },
    sectionBodyText: {
        fontSize: 12,
        color: C.body,
    },
    infoItemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 7,
        borderBottomWidth: 1,
        borderBottomColor: C.borderLight,
    },
    infoItemLbl: {
        fontSize: 11,
        color: C.muted,
        fontWeight: '600',
    },
    infoItemVal: {
        fontSize: 11.5,
        color: C.dark,
        fontWeight: '800',
    },
    mainBtn: {
        paddingVertical: 10,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    mainBtnText: {
        fontSize: 12,
        fontWeight: '900',
    },

    // Modals
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        justifyContent: 'flex-end',
    },
    modalSheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 16,
        maxHeight: '88%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: C.borderLight,
    },
    modalTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: C.dark,
    },
    fieldLabel: {
        fontSize: 10.5,
        fontWeight: '700',
        color: C.muted,
        textTransform: 'uppercase',
        marginBottom: 3,
        marginTop: 6,
    },
    modalInput: {
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 7,
        fontSize: 12,
        color: C.dark,
        backgroundColor: '#F8FAFC',
    },
    uploadBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 7,
        borderWidth: 1,
        borderColor: C.border,
    },
    uploadBtnTxt: {
        fontSize: 10.5,
        fontWeight: '700',
        color: C.dark,
    },
    switchTile: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: C.border,
        backgroundColor: '#F8FAFC',
        marginTop: 8,
    },
    switchTileTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: C.dark,
    },
    switchTileSub: {
        fontSize: 10,
        color: C.muted,
    },
    saveModalBtn: {
        backgroundColor: C.dark,
        paddingVertical: 10,
        borderRadius: 9,
        alignItems: 'center',
        marginTop: 14,
    },
    saveModalBtnTxt: {
        fontSize: 12.5,
        fontWeight: '900',
        color: '#FFFFFF',
    },

    // Dialog
    dialogOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
    },
    dialogBox: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 16,
        width: '100%',
        maxWidth: 340,
        borderWidth: 1,
        borderColor: C.border,
    },
    dialogTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: C.dark,
    },
    dialogSubtitle: {
        fontSize: 11,
        color: C.muted,
        marginTop: 2,
    },
    dialogCancelBtn: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center',
    },
    dialogCancelTxt: {
        fontSize: 11.5,
        fontWeight: '700',
        color: C.body,
    },
    dialogConfirmBtn: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: 'center',
    },
    dialogConfirmTxt: {
        fontSize: 11.5,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 10,
        fontSize: 12,
        fontWeight: '700',
        color: C.muted,
    },
    emptyState: {
        alignItems: 'center',
        marginTop: 36,
    },
    emptyStateText: {
        color: C.muted,
        marginTop: 8,
        fontWeight: '700',
        fontSize: 12,
    },
});
