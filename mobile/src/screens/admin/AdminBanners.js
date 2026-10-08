import React, { useState, useEffect } from 'react';
import { 
    View, Text, TouchableOpacity, Image, TextInput, ScrollView, 
    Alert, ActivityIndicator, Modal, StyleSheet, Dimensions, Platform, RefreshControl, Switch 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { TemuAnnouncementBanner } from '../../components/TemuAnnouncementBanner';

const { width } = Dimensions.get('window');
const NAVY = '#0E1A2E';
const GOLD = '#D9A73A';

const ANNOUNCEMENT_THEMES = [
    { id: 'flame', name: 'Solar Flame', colors: ['#FF4500', '#FF7A00'], icon: 'flame' },
    { id: 'obsidian', name: 'Obsidian Gold', colors: ['#0F172A', '#1E293B'], icon: 'diamond' },
    { id: 'emerald', name: 'Emerald Trust', colors: ['#047857', '#10B981'], icon: 'shield-checkmark' },
    { id: 'cyber', name: 'Cyber Purple', colors: ['#4F46E5', '#7C3AED'], icon: 'flash' },
    { id: 'crimson', name: 'Crimson Heat', colors: ['#BE123C', '#E11D48'], icon: 'flame-outline' },
    { id: 'sapphire', name: 'Sapphire Blue', colors: ['#1D4ED8', '#3B82F6'], icon: 'ribbon-outline' },
];

const BADGE_PRESETS = [
    'FLASH DEAL', 'SPECIAL OFFER', 'FREE DELIVERY', 'LIMITED DEAL', 'BUYER PROTECTION', 'HOT PROMO'
];

export const AdminBanners = () => {
    // Top Tab Switcher: 'announcements' vs 'hero'
    const [bannerType, setBannerType] = useState('announcements');

    // Hero Image Banners State
    const [banners, setBanners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [activeSectionFilter, setActiveSectionFilter] = useState('all');

    // Announcement Bars State
    const [announcements, setAnnouncements] = useState([]);
    const [announcementActive, setAnnouncementActive] = useState(true);
    const [annSyncing, setAnnSyncing] = useState(false);
    const [showAnnModal, setShowAnnModal] = useState(false);
    const [editingAnnId, setEditingAnnId] = useState(null);
    const [annForm, setAnnForm] = useState({
        title: '',
        badge: 'FLASH DEAL',
        gradient: 'flame',
        action_label: 'Claim ➔',
        action_type: 'claim_coupon',
        coupon_code: 'FLASH30',
        is_active: true
    });

    // Hero Form State
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({
        title: '',
        subtitle: '',
        image_url: '',
        action_link: '',
        display_order: '0',
        section: 'home',
        is_active: true
    });

    const SECTIONS = ['landing', 'home', 'shop', 'promo'];

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            await Promise.all([fetchBanners(), fetchAnnouncements()]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const fetchBanners = async () => {
        try {
            const { data, error } = await supabase
                .from('banners')
                .select('*')
                .order('display_order', { ascending: true });

            if (error) {
                console.warn('Error fetching banners:', error.message);
            } else {
                setBanners(data || []);
            }
        } catch (e) {
            console.error('Fetch banners catch:', e);
        }
    };

    const fetchAnnouncements = async () => {
        try {
            const { data: rows } = await supabase
                .from('app_settings')
                .select('key, value')
                .in('key', ['announcements_list', 'announcement_active']);

            if (Array.isArray(rows)) {
                const listRow = rows.find(r => r.key === 'announcements_list');
                const activeRow = rows.find(r => r.key === 'announcement_active');

                if (Array.isArray(listRow?.value)) {
                    setAnnouncements(listRow.value);
                }
                if (activeRow?.value !== undefined) {
                    const val = typeof activeRow.value === 'object' && activeRow.value !== null
                        ? (activeRow.value.value ?? true)
                        : Boolean(activeRow.value);
                    setAnnouncementActive(val);
                }
            }
        } catch (err) {
            console.error('Error fetching announcements from app_settings:', err);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchAllData();
    };

    // ── Announcement Bar Handlers ──
    const handleToggleGlobalAnnouncement = async () => {
        const nextState = !announcementActive;
        setAnnouncementActive(nextState);
        try {
            await supabase.from('app_settings').upsert({
                key: 'announcement_active',
                value: { value: nextState },
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });
        } catch (err) {
            console.error('Failed to toggle global announcement:', err);
        }
    };

    const handleSaveAnnouncement = async () => {
        if (!annForm.title.trim()) {
            Alert.alert('Required', 'Please enter an announcement message.');
            return;
        }

        setAnnSyncing(true);
        try {
            let updatedList = [...announcements];
            if (editingAnnId) {
                updatedList = updatedList.map(a => 
                    a.id === editingAnnId ? { ...a, ...annForm, id: editingAnnId } : a
                );
            } else {
                const newItem = {
                    id: `ann_${Date.now()}`,
                    ...annForm
                };
                updatedList.unshift(newItem);
            }

            // Also synchronize top primary announcement text with the first active item
            const primaryActive = updatedList.find(a => a.is_active) || updatedList[0];

            await Promise.all([
                supabase.from('app_settings').upsert({
                    key: 'announcements_list',
                    value: updatedList,
                    description: 'Dynamic list of top announcement bars',
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' }),

                primaryActive ? supabase.from('app_settings').upsert({
                    key: 'announcement_text',
                    value: { value: primaryActive.title },
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' }) : Promise.resolve(),

                primaryActive ? supabase.from('app_settings').upsert({
                    key: 'announcement_badge',
                    value: { value: primaryActive.badge },
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' }) : Promise.resolve(),

                primaryActive?.coupon_code ? supabase.from('app_settings').upsert({
                    key: 'announcement_coupon_code',
                    value: { value: primaryActive.coupon_code },
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' }) : Promise.resolve(),

                primaryActive?.gradient ? supabase.from('app_settings').upsert({
                    key: 'announcement_style',
                    value: { value: primaryActive.gradient },
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' }) : Promise.resolve()
            ]);

            setAnnouncements(updatedList);
            setShowAnnModal(false);
            resetAnnForm();
            Alert.alert('Success', 'Announcement bar saved and deployed live!');
        } catch (err) {
            Alert.alert('Error', err.message || 'Failed to save announcement bar.');
        } finally {
            setAnnSyncing(false);
        }
    };

    const handleToggleAnnouncementItem = async (item) => {
        const nextState = !item.is_active;
        const updatedList = announcements.map(a => 
            a.id === item.id ? { ...a, is_active: nextState } : a
        );
        setAnnouncements(updatedList);

        try {
            await supabase.from('app_settings').upsert({
                key: 'announcements_list',
                value: updatedList,
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });
        } catch (err) {
            console.error('Error toggling announcement item:', err);
        }
    };

    const handleDeleteAnnouncement = async (id) => {
        Alert.alert('Delete Announcement', 'Are you sure you want to remove this announcement bar?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    const updatedList = announcements.filter(a => a.id !== id);
                    setAnnouncements(updatedList);
                    try {
                        await supabase.from('app_settings').upsert({
                            key: 'announcements_list',
                            value: updatedList,
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'key' });
                    } catch (err) {
                        console.error('Error deleting announcement:', err);
                    }
                }
            }
        ]);
    };

    const handleEditAnnouncement = (item) => {
        setEditingAnnId(item.id);
        setAnnForm({
            title: item.title || '',
            badge: item.badge || 'FLASH DEAL',
            gradient: item.gradient || 'flame',
            action_label: item.action_label || 'Claim ➔',
            action_type: item.action_type || 'claim_coupon',
            coupon_code: item.coupon_code || 'FLASH30',
            is_active: item.is_active ?? true
        });
        setShowAnnModal(true);
    };

    const resetAnnForm = () => {
        setEditingAnnId(null);
        setAnnForm({
            title: '',
            badge: 'FLASH DEAL',
            gradient: 'flame',
            action_label: 'Claim ➔',
            action_type: 'claim_coupon',
            coupon_code: 'FLASH30',
            is_active: true
        });
    };

    // ── Hero Banner Handlers ──
    const pickImage = async () => {
        try {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permissionResult.granted) {
                Alert.alert('Permission', 'Gallery access is required to upload banner image.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: form.section === 'shop' ? [2, 1] : [16, 9],
                quality: 0.85,
                base64: true
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                await uploadImageToSupabase(asset);
            }
        } catch (e) {
            Alert.alert('Error', 'Failed to pick image.');
        }
    };

    const uploadImageToSupabase = async (asset) => {
        try {
            setUploading(true);
            const fileName = `banner_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
            const fileData = decode(asset.base64);

            let uploadRes = await supabase.storage.from('banners').upload(fileName, fileData, {
                contentType: 'image/jpeg',
                upsert: true
            });

            let finalBucket = 'banners';
            if (uploadRes.error) {
                uploadRes = await supabase.storage.from('products').upload(fileName, fileData, {
                    contentType: 'image/jpeg',
                    upsert: true
                });
                finalBucket = 'products';
            }

            if (uploadRes.error) throw uploadRes.error;

            const { data: publicUrlData } = supabase.storage.from(finalBucket).getPublicUrl(fileName);
            if (publicUrlData?.publicUrl) {
                setForm(prev => ({ ...prev, image_url: publicUrlData.publicUrl }));
                Alert.alert('Success', 'Banner image uploaded successfully!');
            }
        } catch (error) {
            Alert.alert('Upload Error', error.message || 'Failed to upload banner image.');
        } finally {
            setUploading(false);
        }
    };

    const handleEdit = (banner) => {
        setEditingId(banner.id);
        setForm({
            title: banner.title || '',
            subtitle: banner.subtitle || '',
            image_url: banner.image_url || '',
            action_link: banner.action_link || '',
            display_order: String(banner.display_order ?? 0),
            section: banner.section || 'home',
            is_active: banner.is_active ?? true
        });
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        Alert.alert('Delete Banner', 'Are you sure you want to delete this promotional banner?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    const { error } = await supabase.from('banners').delete().eq('id', id);
                    if (error) {
                        Alert.alert('Error', error.message);
                    } else {
                        fetchBanners();
                    }
                }
            }
        ]);
    };

    const handleSave = async () => {
        if (!form.image_url) {
            Alert.alert('Error', 'Banner image is required.');
            return;
        }

        setUploading(true);
        const bannerData = {
            title: form.title || '',
            subtitle: form.subtitle || '',
            image_url: form.image_url,
            action_link: form.action_link || '',
            display_order: parseInt(form.display_order, 10) || 0,
            section: form.section || 'home',
            is_active: form.is_active ?? true
        };

        let error;
        if (editingId) {
            const { error: updateError } = await supabase
                .from('banners')
                .update(bannerData)
                .eq('id', editingId);
            error = updateError;
        } else {
            const { error: insertError } = await supabase
                .from('banners')
                .insert([bannerData]);
            error = insertError;
        }

        setUploading(false);
        if (error) {
            Alert.alert('Error', error.message);
        } else {
            setShowForm(false);
            resetForm();
            fetchBanners();
        }
    };

    const resetForm = () => {
        setForm({ 
            title: '', 
            subtitle: '', 
            image_url: '', 
            action_link: '', 
            display_order: '0', 
            section: 'home',
            is_active: true 
        });
        setEditingId(null);
    };

    const toggleActive = async (banner) => {
        const nextState = !banner.is_active;
        const { error } = await supabase
            .from('banners')
            .update({ is_active: nextState })
            .eq('id', banner.id);
            
        if (!error) {
            setBanners(prev => prev.map(b => b.id === banner.id ? { ...b, is_active: nextState } : b));
        } else {
            Alert.alert('Error', error.message);
        }
    };

    const filteredBanners = activeSectionFilter === 'all' 
        ? banners 
        : banners.filter(b => (b.section || 'home') === activeSectionFilter);

    return (
        <View style={s.container}>
            {/* Header */}
            <View style={s.header}>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="megaphone" size={24} color={GOLD} />
                        <Text style={s.headerTitle}>Marketing Banners</Text>
                    </View>
                    <Text style={s.headerSubtitle}>Manage rotating announcement bars and hero slides</Text>
                </View>
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                        if (bannerType === 'announcements') {
                            resetAnnForm();
                            setShowAnnModal(true);
                        } else {
                            resetForm();
                            setShowForm(true);
                        }
                    }}
                    style={s.createButton}
                >
                    <Ionicons name="add-circle" size={18} color="#FFFFFF" />
                    <Text style={s.createButtonText}>+ Create</Text>
                </TouchableOpacity>
            </View>

            {/* Top Segment Switcher: Announcement Bars vs Hero Slides */}
            <View style={s.segmentContainer}>
                <TouchableOpacity
                    onPress={() => setBannerType('announcements')}
                    style={[s.segmentBtn, bannerType === 'announcements' && s.segmentBtnActive]}
                >
                    <Ionicons 
                        name="megaphone" 
                        size={15} 
                        color={bannerType === 'announcements' ? '#FFFFFF' : '#64748B'} 
                    />
                    <Text style={[s.segmentBtnText, bannerType === 'announcements' && s.segmentBtnTextActive]}>
                        Top Announcement Bars ({announcements.length})
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setBannerType('hero')}
                    style={[s.segmentBtn, bannerType === 'hero' && s.segmentBtnActive]}
                >
                    <Ionicons 
                        name="images" 
                        size={15} 
                        color={bannerType === 'hero' ? '#FFFFFF' : '#64748B'} 
                    />
                    <Text style={[s.segmentBtnText, bannerType === 'hero' && s.segmentBtnTextActive]}>
                        Hero Slides ({banners.length})
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Content List */}
            {loading ? (
                <View style={s.centered}>
                    <ActivityIndicator size="large" color={GOLD} />
                    <Text style={s.loadingText}>Loading banners...</Text>
                </View>
            ) : bannerType === 'announcements' ? (
                // ─── ANNOUNCEMENT BARS TAB ───
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[GOLD, NAVY]} />}
                >
                    {/* Live Customer Preview */}
                    <View style={s.previewCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Text style={s.previewCardLabel}>LIVE HEADER PREVIEW</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: announcementActive ? '#10B981' : '#94A3B8' }} />
                                <Text style={{ fontSize: 10, fontWeight: '800', color: announcementActive ? '#059669' : '#64748B' }}>
                                    {announcementActive ? 'ACTIVE LIVE' : 'DISABLED'}
                                </Text>
                            </View>
                        </View>
                        <TemuAnnouncementBanner
                            settings={{
                                announcement_active: announcementActive,
                                announcements_list: announcements
                            }}
                        />
                    </View>

                    {/* Master Sitewide Toggle Card */}
                    <View style={s.toggleCard}>
                        <View style={{ flex: 1, marginRight: 12 }}>
                            <Text style={s.toggleCardTitle}>Enable Announcement Bar on App Header</Text>
                            <Text style={s.toggleCardSub}>
                                When turned on, customers see these rotating smart alerts at the top of Home and Landing pages.
                            </Text>
                        </View>
                        <Switch
                            value={announcementActive}
                            onValueChange={handleToggleGlobalAnnouncement}
                            trackColor={{ false: '#CBD5E1', true: '#FF4500' }}
                            thumbColor="#FFFFFF"
                        />
                    </View>

                    {/* Announcements List Header */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: 10 }}>
                        <Text style={s.sectionTitle}>All Announcement Bars</Text>
                        <TouchableOpacity
                            onPress={() => { resetAnnForm(); setShowAnnModal(true); }}
                            style={s.addNewPillBtn}
                        >
                            <Ionicons name="add" size={14} color="#FFFFFF" />
                            <Text style={s.addNewPillBtnText}>Add New Bar</Text>
                        </TouchableOpacity>
                    </View>

                    {announcements.length === 0 ? (
                        <View style={s.emptyStateContainer}>
                            <View style={s.emptyIconCircle}>
                                <Ionicons name="megaphone-outline" size={44} color={GOLD} />
                            </View>
                            <Text style={s.emptyStateTitle}>No Announcement Bars Created</Text>
                            <Text style={s.emptyStateSub}>Create dynamic rotating announcement bars to highlight promos, shipping and perks.</Text>
                            <TouchableOpacity
                                onPress={() => { resetAnnForm(); setShowAnnModal(true); }}
                                style={s.emptyCreateBtn}
                            >
                                <Ionicons name="add" size={18} color="#FFFFFF" />
                                <Text style={s.emptyCreateBtnText}>Create Announcement Bar</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        announcements.map((item, index) => {
                            const themeMatch = ANNOUNCEMENT_THEMES.find(t => t.id === item.gradient) || ANNOUNCEMENT_THEMES[0];
                            return (
                                <View key={item.id || index} style={s.annCard}>
                                    <View style={s.annCardTop}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                            <View style={[s.annBadgePill, { backgroundColor: themeMatch.colors[0] }]}>
                                                <Ionicons name={themeMatch.icon} size={11} color="#FFFFFF" />
                                                <Text style={s.annBadgePillText}>{item.badge || 'PROMO'}</Text>
                                            </View>
                                            <Text style={s.annThemeLabel}>{themeMatch.name}</Text>
                                        </View>
                                        <Switch
                                            value={item.is_active ?? true}
                                            onValueChange={() => handleToggleAnnouncementItem(item)}
                                            trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                                            thumbColor="#FFFFFF"
                                        />
                                    </View>

                                    <Text style={s.annCardText}>{item.title}</Text>

                                    <View style={s.annCardMetaRow}>
                                        <View style={s.annMetaChip}>
                                            <Text style={s.annMetaChipLabel}>Action:</Text>
                                            <Text style={s.annMetaChipValue}>{item.action_label || 'Claim ➔'}</Text>
                                        </View>
                                        {item.coupon_code ? (
                                            <View style={s.annMetaChip}>
                                                <Text style={s.annMetaChipLabel}>Coupon:</Text>
                                                <Text style={[s.annMetaChipValue, { color: '#FF4500' }]}>{item.coupon_code}</Text>
                                            </View>
                                        ) : null}
                                    </View>

                                    <View style={s.annCardActions}>
                                        <TouchableOpacity
                                            onPress={() => handleEditAnnouncement(item)}
                                            style={s.annEditBtn}
                                        >
                                            <Ionicons name="pencil" size={14} color={NAVY} />
                                            <Text style={s.annEditBtnText}>Edit</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => handleDeleteAnnouncement(item.id)}
                                            style={s.annDeleteBtn}
                                        >
                                            <Ionicons name="trash-outline" size={14} color="#EF4444" />
                                            <Text style={s.annDeleteBtnText}>Delete</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </ScrollView>
            ) : (
                // ─── HERO SLIDES TAB ───
                <>
                    {/* Filter Tabs */}
                    <View style={s.filterTabsContainer}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                            <TouchableOpacity
                                onPress={() => setActiveSectionFilter('all')}
                                style={[s.filterChip, activeSectionFilter === 'all' && s.filterChipActive]}
                            >
                                <Text style={[s.filterChipText, activeSectionFilter === 'all' && s.filterChipTextActive]}>
                                    All ({banners.length})
                                </Text>
                            </TouchableOpacity>
                            {SECTIONS.map(sec => {
                                const count = banners.filter(b => (b.section || 'home') === sec).length;
                                const isActive = activeSectionFilter === sec;
                                return (
                                    <TouchableOpacity
                                        key={sec}
                                        onPress={() => setActiveSectionFilter(sec)}
                                        style={[s.filterChip, isActive && s.filterChipActive]}
                                    >
                                        <Text style={[s.filterChipText, isActive && s.filterChipTextActive]}>
                                            {sec.toUpperCase()} ({count})
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[GOLD, NAVY]} />}
                    >
                        {filteredBanners.length === 0 ? (
                            <View style={s.emptyStateContainer}>
                                <View style={s.emptyIconCircle}>
                                    <Ionicons name="images-outline" size={48} color={GOLD} />
                                </View>
                                <Text style={s.emptyStateTitle}>No Banners Found</Text>
                                <Text style={s.emptyStateSub}>Tap '+ Create' to upload a promotional hero slide.</Text>
                                <TouchableOpacity
                                    onPress={() => { resetForm(); setShowForm(true); }}
                                    style={s.emptyCreateBtn}
                                >
                                    <Ionicons name="add" size={18} color="#FFFFFF" />
                                    <Text style={s.emptyCreateBtnText}>Create Banner Now</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            filteredBanners.map(item => (
                                <View key={item.id} style={s.bannerCard}>
                                    <View style={s.bannerImageWrapper}>
                                        <Image 
                                            source={{ uri: item.image_url }} 
                                            style={s.bannerImage} 
                                            resizeMode="cover" 
                                        />
                                        <View style={s.sectionBadge}>
                                            <Text style={s.sectionBadgeText}>{(item.section || 'home').toUpperCase()}</Text>
                                        </View>
                                        <View style={s.orderBadge}>
                                            <Ionicons name="swap-vertical" size={12} color="#FFFFFF" />
                                            <Text style={s.orderBadgeText}>Order: #{item.display_order ?? 0}</Text>
                                        </View>
                                    </View>

                                    <View style={s.cardBody}>
                                        <View style={{ flex: 1 }}>
                                            {item.title ? (
                                                <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
                                            ) : (
                                                <Text style={[s.cardTitle, { color: '#94A3B8' }]}>No Title</Text>
                                            )}
                                            {item.subtitle ? (
                                                <Text style={s.cardSubtitle} numberOfLines={1}>{item.subtitle}</Text>
                                            ) : null}
                                        </View>

                                        <View style={s.cardActions}>
                                            <TouchableOpacity
                                                activeOpacity={0.8}
                                                onPress={() => toggleActive(item)}
                                                style={[
                                                    s.statusBtn,
                                                    { backgroundColor: item.is_active ? '#ECFDF5' : '#F1F5F9', borderColor: item.is_active ? '#10B981' : '#CBD5E1' }
                                                ]}
                                            >
                                                <Ionicons 
                                                    name={item.is_active ? "eye" : "eye-off"} 
                                                    size={16} 
                                                    color={item.is_active ? '#059669' : '#64748B'} 
                                                />
                                                <Text style={[s.statusBtnText, { color: item.is_active ? '#059669' : '#64748B' }]}>
                                                    {item.is_active ? 'Active' : 'Hidden'}
                                                </Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                activeOpacity={0.8}
                                                onPress={() => handleEdit(item)}
                                                style={s.editBtn}
                                            >
                                                <Ionicons name="pencil" size={16} color={NAVY} />
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                activeOpacity={0.8}
                                                onPress={() => handleDelete(item.id)}
                                                style={s.deleteBtn}
                                            >
                                                <Ionicons name="trash-outline" size={16} color="#EF4444" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            ))
                        )}
                    </ScrollView>
                </>
            )}

            {/* ─── CREATE / EDIT ANNOUNCEMENT MODAL ─── */}
            <Modal
                visible={showAnnModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowAnnModal(false)}
            >
                <View style={s.modalOverlay}>
                    <View style={s.modalContainer}>
                        <View style={s.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={s.modalIconCircle}>
                                    <Ionicons name="megaphone" size={18} color={GOLD} />
                                </View>
                                <Text style={s.modalTitle}>
                                    {editingAnnId ? 'Edit Announcement Bar' : 'Create Announcement Bar'}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowAnnModal(false)} style={s.closeButton}>
                                <Ionicons name="close" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={s.modalForm} showsVerticalScrollIndicator={false}>
                            {/* Message Input */}
                            <Text style={s.inputLabel}>ANNOUNCEMENT MESSAGE *</Text>
                            <TextInput
                                style={[s.textInput, { height: 75, textAlignVertical: 'top', paddingTop: 10 }]}
                                placeholder="e.g. ⚡ Flash Deals: Up to 50% Off Limited Time Items!"
                                placeholderTextColor="#94A3B8"
                                value={annForm.title}
                                multiline
                                onChangeText={v => setAnnForm(p => ({ ...p, title: v }))}
                            />

                            {/* Badge Label and Quick Chips */}
                            <Text style={[s.inputLabel, { marginTop: 14 }]}>BADGE PILL TEXT *</Text>
                            <TextInput
                                style={s.textInput}
                                placeholder="e.g. FLASH DEAL"
                                placeholderTextColor="#94A3B8"
                                value={annForm.badge}
                                onChangeText={v => setAnnForm(p => ({ ...p, badge: v }))}
                            />
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                                {BADGE_PRESETS.map(b => (
                                    <TouchableOpacity
                                        key={b}
                                        onPress={() => setAnnForm(p => ({ ...p, badge: b }))}
                                        style={[
                                            s.badgeChip,
                                            annForm.badge === b && s.badgeChipActive
                                        ]}
                                    >
                                        <Text style={[s.badgeChipText, annForm.badge === b && s.badgeChipTextActive]}>
                                            {b}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Gradient Theme Selector */}
                            <Text style={[s.inputLabel, { marginTop: 16 }]}>GRADIENT COLOR THEME</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                                {ANNOUNCEMENT_THEMES.map(theme => {
                                    const isSelected = annForm.gradient === theme.id;
                                    return (
                                        <TouchableOpacity
                                            key={theme.id}
                                            onPress={() => setAnnForm(p => ({ ...p, gradient: theme.id }))}
                                            style={[
                                                s.themeSelectChip,
                                                { backgroundColor: theme.colors[0] },
                                                isSelected && s.themeSelectChipActive
                                            ]}
                                        >
                                            <Ionicons name={theme.icon} size={12} color="#FFFFFF" />
                                            <Text style={s.themeSelectChipText}>{theme.name}</Text>
                                            {isSelected && (
                                                <Ionicons name="checkmark-circle" size={13} color="#FFFFFF" />
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Action Button CTA Label */}
                            <Text style={[s.inputLabel, { marginTop: 16 }]}>ACTION BUTTON CTA LABEL</Text>
                            <TextInput
                                style={s.textInput}
                                placeholder="e.g. Claim ➔"
                                placeholderTextColor="#94A3B8"
                                value={annForm.action_label}
                                onChangeText={v => setAnnForm(p => ({ ...p, action_label: v }))}
                            />

                            {/* Promo Voucher Code */}
                            <Text style={[s.inputLabel, { marginTop: 14 }]}>LINKED PROMO VOUCHER CODE</Text>
                            <TextInput
                                style={s.textInput}
                                placeholder="e.g. FLASH30"
                                placeholderTextColor="#94A3B8"
                                value={annForm.coupon_code}
                                autoCapitalize="characters"
                                onChangeText={v => setAnnForm(p => ({ ...p, coupon_code: v.toUpperCase() }))}
                            />
                            <Text style={s.fieldHint}>
                                When customers tap 'Claim', this code is copied and automatically applied to checkout.
                            </Text>

                            {/* Active Switch */}
                            <View style={s.formSwitchRow}>
                                <Text style={s.formSwitchLabel}>Active Immediately</Text>
                                <Switch
                                    value={annForm.is_active}
                                    onValueChange={v => setAnnForm(p => ({ ...p, is_active: v }))}
                                    trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                                    thumbColor="#FFFFFF"
                                />
                            </View>

                            {/* Submit Button */}
                            <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={handleSaveAnnouncement}
                                disabled={annSyncing}
                                style={s.saveButton}
                            >
                                {annSyncing ? (
                                    <ActivityIndicator size="small" color={NAVY} />
                                ) : (
                                    <Text style={s.saveButtonText}>
                                        {editingAnnId ? 'Save Changes' : 'Create & Deploy Bar'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* ─── CREATE / EDIT HERO BANNER MODAL ─── */}
            <Modal
                visible={showForm}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowForm(false)}
            >
                <View style={s.modalOverlay}>
                    <View style={s.modalContainer}>
                        <View style={s.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={s.modalIconCircle}>
                                    <Ionicons name="images" size={18} color={GOLD} />
                                </View>
                                <Text style={s.modalTitle}>
                                    {editingId ? 'Edit Hero Banner' : 'Create Hero Banner'}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowForm(false)} style={s.closeButton}>
                                <Ionicons name="close" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={s.modalForm} showsVerticalScrollIndicator={false}>
                            {/* Image Upload Box */}
                            <Text style={s.inputLabel}>BANNER IMAGE *</Text>
                            <TouchableOpacity 
                                activeOpacity={0.8}
                                onPress={pickImage} 
                                style={s.uploadBox}
                            >
                                {form.image_url ? (
                                    <View style={{ position: 'relative', width: '100%', height: '100%' }}>
                                        <Image source={{ uri: form.image_url }} style={s.uploadedImage} resizeMode="cover" />
                                        <View style={s.changeImageOverlay}>
                                            <Ionicons name="camera" size={16} color="#FFFFFF" />
                                            <Text style={s.changeImageText}>Change</Text>
                                        </View>
                                    </View>
                                ) : (
                                    <View style={s.uploadPlaceholder}>
                                        <View style={s.cameraIconBg}>
                                            <Ionicons name="cloud-upload" size={24} color={GOLD} />
                                        </View>
                                        <Text style={s.uploadTextPrimary}>Tap to upload banner image</Text>
                                        <Text style={s.uploadTextSub}>Recommended: 16:9 HD ratio</Text>
                                    </View>
                                )}
                            </TouchableOpacity>

                            {/* Section Selector */}
                            <Text style={[s.inputLabel, { marginTop: 14 }]}>PLACEMENT SLOT *</Text>
                            <View style={s.sectionSelector}>
                                {SECTIONS.map(sec => (
                                    <TouchableOpacity
                                        key={sec}
                                        onPress={() => setForm(p => ({ ...p, section: sec }))}
                                        style={[s.secOption, form.section === sec && s.secOptionActive]}
                                    >
                                        <Text style={[s.secOptionText, form.section === sec && s.secOptionTextActive]}>
                                            {sec.toUpperCase()}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={[s.inputLabel, { marginTop: 14 }]}>BANNER TITLE (OPTIONAL)</Text>
                            <TextInput
                                style={s.textInput}
                                placeholder="e.g. Summer Mega Deals"
                                placeholderTextColor="#94A3B8"
                                value={form.title}
                                onChangeText={v => setForm(p => ({ ...p, title: v }))}
                            />

                            <Text style={[s.inputLabel, { marginTop: 14 }]}>SUBTITLE / TAGLINE</Text>
                            <TextInput
                                style={s.textInput}
                                placeholder="e.g. Up to 50% discount on selected items"
                                placeholderTextColor="#94A3B8"
                                value={form.subtitle}
                                onChangeText={v => setForm(p => ({ ...p, subtitle: v }))}
                            />

                            <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={handleSave}
                                disabled={uploading}
                                style={s.saveButton}
                            >
                                {uploading ? (
                                    <ActivityIndicator size="small" color={NAVY} />
                                ) : (
                                    <Text style={s.saveButtonText}>
                                        {editingId ? 'Save Changes' : 'Publish Banner'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: NAVY,
        letterSpacing: -0.3
    },
    headerSubtitle: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 2
    },
    createButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: NAVY,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 11,
        borderWidth: 1,
        borderColor: GOLD
    },
    createButtonText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800'
    },
    segmentContainer: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
        padding: 4,
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 8
    },
    segmentBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 9,
        borderRadius: 9
    },
    segmentBtnActive: {
        backgroundColor: NAVY,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2
    },
    segmentBtnText: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#64748B'
    },
    segmentBtnTextActive: {
        color: '#FFFFFF',
        fontWeight: '900'
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40
    },
    loadingText: {
        marginTop: 10,
        fontSize: 13,
        color: '#64748B',
        fontWeight: '600'
    },
    previewCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1
    },
    previewCardLabel: {
        fontSize: 9.5,
        fontWeight: '900',
        color: '#64748B',
        letterSpacing: 0.8
    },
    toggleCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    toggleCardTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: NAVY
    },
    toggleCardSub: {
        fontSize: 11,
        color: '#64748B',
        lineHeight: 16,
        marginTop: 2
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '900',
        color: NAVY
    },
    addNewPillBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: NAVY,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8
    },
    addNewPillBtnText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#FFFFFF'
    },
    annCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1
    },
    annCardTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8
    },
    annBadgePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 6
    },
    annBadgePillText: {
        color: '#FFFFFF',
        fontSize: 9.5,
        fontWeight: '900',
        letterSpacing: 0.3
    },
    annThemeLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B'
    },
    annCardText: {
        fontSize: 12.5,
        fontWeight: '800',
        color: NAVY,
        lineHeight: 18,
        marginBottom: 10
    },
    annCardMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10
    },
    annMetaChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    annMetaChipLabel: {
        fontSize: 9.5,
        fontWeight: '700',
        color: '#94A3B8'
    },
    annMetaChipValue: {
        fontSize: 10,
        fontWeight: '800',
        color: NAVY
    },
    annCardActions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 8,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingTop: 8
    },
    annEditBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: '#F1F5F9'
    },
    annEditBtnText: {
        fontSize: 11,
        fontWeight: '700',
        color: NAVY
    },
    annDeleteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: '#FEF2F2'
    },
    annDeleteBtnText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#EF4444'
    },
    // Filter Tabs
    filterTabsContainer: {
        paddingVertical: 8,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    filterChip: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 18,
        backgroundColor: '#F1F5F9'
    },
    filterChipActive: {
        backgroundColor: NAVY
    },
    filterChipText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B'
    },
    filterChipTextActive: {
        color: '#FFFFFF',
        fontWeight: '800'
    },
    // Hero Banner Card
    bannerCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        overflow: 'hidden',
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1
    },
    bannerImageWrapper: {
        width: '100%',
        height: 140,
        position: 'relative'
    },
    bannerImage: {
        width: '100%',
        height: '100%'
    },
    sectionBadge: {
        position: 'absolute',
        top: 10,
        left: 10,
        backgroundColor: 'rgba(14, 26, 46, 0.85)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6
    },
    sectionBadgeText: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.5
    },
    orderBadge: {
        position: 'absolute',
        bottom: 10,
        right: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6
    },
    orderBadgeText: {
        color: '#FFFFFF',
        fontSize: 9.5,
        fontWeight: '800'
    },
    cardBody: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12
    },
    cardTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: NAVY
    },
    cardSubtitle: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 2
    },
    cardActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    statusBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1
    },
    statusBtnText: {
        fontSize: 10,
        fontWeight: '800'
    },
    editBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center'
    },
    deleteBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#FEF2F2',
        alignItems: 'center',
        justifyContent: 'center'
    },
    // Empty state
    emptyStateContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
        paddingHorizontal: 20
    },
    emptyIconCircle: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#FFFBEB',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14
    },
    emptyStateTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: NAVY
    },
    emptyStateSub: {
        fontSize: 11.5,
        color: '#64748B',
        textAlign: 'center',
        marginTop: 4,
        lineHeight: 16
    },
    emptyCreateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: NAVY,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        marginTop: 16
    },
    emptyCreateBtnText: {
        color: '#FFFFFF',
        fontSize: 12.5,
        fontWeight: '800'
    },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.65)',
        justifyContent: 'flex-end'
    },
    modalContainer: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
        paddingBottom: 24
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 18,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    modalIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FFFBEB',
        alignItems: 'center',
        justifyContent: 'center'
    },
    modalTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: NAVY
    },
    closeButton: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center'
    },
    modalForm: {
        paddingHorizontal: 18,
        paddingTop: 14
    },
    inputLabel: {
        fontSize: 10,
        fontWeight: '900',
        color: '#64748B',
        letterSpacing: 0.5,
        marginBottom: 6
    },
    textInput: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 11,
        fontSize: 13,
        color: NAVY,
        fontWeight: '600'
    },
    fieldHint: {
        fontSize: 10,
        color: '#94A3B8',
        marginTop: 4
    },
    badgeChip: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    badgeChipActive: {
        backgroundColor: NAVY,
        borderColor: NAVY
    },
    badgeChipText: {
        fontSize: 9.5,
        fontWeight: '800',
        color: '#64748B'
    },
    badgeChipTextActive: {
        color: '#FFFFFF'
    },
    themeSelectChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: 'transparent'
    },
    themeSelectChipActive: {
        borderColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
        elevation: 3
    },
    themeSelectChipText: {
        color: '#FFFFFF',
        fontSize: 10.5,
        fontWeight: '800'
    },
    formSwitchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 16,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9'
    },
    formSwitchLabel: {
        fontSize: 13,
        fontWeight: '800',
        color: NAVY
    },
    uploadBox: {
        width: '100%',
        height: 150,
        backgroundColor: '#F8FAFC',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        borderStyle: 'dashed',
        borderRadius: 14,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center'
    },
    uploadedImage: {
        width: '100%',
        height: '100%'
    },
    changeImageOverlay: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        backgroundColor: 'rgba(14, 26, 46, 0.85)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6
    },
    changeImageText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '800'
    },
    uploadPlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
    },
    cameraIconBg: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FFFBEB',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8
    },
    uploadTextPrimary: {
        fontSize: 12.5,
        fontWeight: '800',
        color: NAVY
    },
    uploadTextSub: {
        fontSize: 10,
        color: '#94A3B8',
        marginTop: 2
    },
    sectionSelector: {
        flexDirection: 'row',
        gap: 8
    },
    secOption: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 8,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    secOptionActive: {
        backgroundColor: NAVY,
        borderColor: NAVY
    },
    secOptionText: {
        fontSize: 10.5,
        fontWeight: '800',
        color: '#64748B'
    },
    secOptionTextActive: {
        color: '#FFFFFF'
    },
    saveButton: {
        backgroundColor: GOLD,
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
        marginBottom: 30
    },
    saveButtonText: {
        color: NAVY,
        fontSize: 13.5,
        fontWeight: '900'
    }
});
