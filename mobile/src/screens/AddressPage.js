import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    View, Text, TouchableOpacity, ScrollView, SafeAreaView, TextInput, 
    Alert, StyleSheet, ActivityIndicator, RefreshControl, KeyboardAvoidingView, 
    Platform, Switch, Modal, FlatList, StatusBar 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { NIGERIA_DATA } from '../data/nigeriaData';
import { NIGERIA_STATE_CENTROIDS, NIGERIA_LGA_CENTROIDS } from '../services/shippingService';
import * as Location from 'expo-location';

const NAVY = '#0E1A2E';
const GOLD = '#D9A73A';
const QUICK_TITLES = ['Home', 'Office', 'Shop', 'Warehouse', 'Family'];

export const AddressPage = ({ navigation, onBack }) => {
    const handleBack = () => {
        if (onBack) onBack();
        else if (navigation && navigation.canGoBack()) navigation.goBack();
    };

    const [addresses, setAddresses] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [locating, setLocating] = useState(false);

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [modalType, setModalType] = useState(null); // 'state' or 'lga'
    const [searchQuery, setSearchQuery] = useState('');

    // Form State
    const [formData, setFormData] = useState({
        title: 'Home',
        address: '',
        city: '', // LGA
        state: '',
        phone: '',
        latitude: null,
        longitude: null,
        isDefault: false
    });

    useEffect(() => {
        fetchAddresses();
    }, []);

    const fetchAddresses = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('addresses')
                .select('*')
                .eq('user_id', user.id)
                .order('is_default', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) throw error;
            setAddresses(data || []);
        } catch (error) {
            console.log('Error fetching addresses:', error);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchAddresses().then(() => setRefreshing(false));
    }, []);

    const handleEdit = (addr) => {
        setFormData({
            title: addr.title || 'Home',
            address: addr.address || '',
            city: addr.city || addr.lga || '',
            state: addr.state || '',
            phone: addr.phone || '',
            latitude: addr.latitude || null,
            longitude: addr.longitude || null,
            isDefault: Boolean(addr.is_default)
        });
        setEditingId(addr.id);
        setIsAdding(true);
    };

    const handleUseLocation = async () => {
        setLocating(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Please grant location permission to detect your delivery address.');
                setLocating(false);
                return;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Highest,
                maximumAge: 10000
            });

            const geocode = await Location.reverseGeocodeAsync({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude
            });

            if (geocode && geocode.length > 0) {
                const item = geocode[0];
                const parts = [];

                if (item.name && item.name !== item.street) parts.push(item.name);
                if (item.street) parts.push(item.street);
                if (item.streetNumber) parts.push(item.streetNumber);
                if (item.district) parts.push(item.district);
                if (item.subregion && item.subregion !== item.city) parts.push(item.subregion);

                const cleanParts = parts.filter(p => p && p !== item.isoCountryCode && p !== item.country);
                const fullAddress = cleanParts.length > 0 ? cleanParts.join(', ') : item.city || '';

                const cleanString = (str) => (str || '').toLowerCase().trim();
                const regionSearch = cleanString(item.region).replace(' state', '');

                let matchedState = '';
                let matchedLga = '';

                const foundState = NIGERIA_DATA.find(s => cleanString(s.state) === regionSearch || cleanString(s.state) === cleanString(item.region));
                if (foundState) {
                    matchedState = foundState.state;
                    const potentialLgas = [item.city, item.subregion, item.district].map(cleanString);
                    const foundLga = foundState.lgas.find(l => potentialLgas.includes(cleanString(l)));
                    if (foundLga) matchedLga = foundLga;
                }

                setFormData(prev => ({
                    ...prev,
                    address: fullAddress || prev.address,
                    state: matchedState || prev.state,
                    city: matchedLga || prev.city,
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    title: prev.title || 'Home'
                }));
            }
        } catch (error) {
            Alert.alert('Location Notice', 'Could not auto-detect GPS location: ' + error.message);
        } finally {
            setLocating(false);
        }
    };

    const handleAddAddress = async () => {
        if (!formData.title || !formData.address || !formData.city || !formData.state || !formData.phone) {
            Alert.alert('Missing Fields', 'Please select both State and Local Government (LGA), and enter full street address and phone number.');
            return;
        }

        try {
            setSubmitting(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                Alert.alert('Authentication Required', 'You must be logged in to save addresses.');
                return;
            }

            // Fallback coordinates from LGA or State Centroid if GPS was unavailable
            let lat = formData.latitude;
            let lon = formData.longitude;
            if (!lat || !lon) {
                if (formData.city && NIGERIA_LGA_CENTROIDS && NIGERIA_LGA_CENTROIDS[formData.city]) {
                    lat = NIGERIA_LGA_CENTROIDS[formData.city].lat;
                    lon = NIGERIA_LGA_CENTROIDS[formData.city].lon;
                } else if (formData.state && NIGERIA_STATE_CENTROIDS && NIGERIA_STATE_CENTROIDS[formData.state]) {
                    lat = NIGERIA_STATE_CENTROIDS[formData.state].lat;
                    lon = NIGERIA_STATE_CENTROIDS[formData.state].lon;
                }
            }

            const payload = {
                user_id: user.id,
                title: formData.title,
                address: formData.address,
                city: formData.city, // Stores LGA
                lga: formData.city,  // Explicit LGA column
                state: formData.state,
                phone: formData.phone,
                latitude: lat ? parseFloat(lat) : null,
                longitude: lon ? parseFloat(lon) : null,
                is_default: formData.isDefault
            };

            if (editingId) {
                if (payload.is_default) {
                    await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id);
                }
                const { error: updateError } = await supabase
                    .from('addresses')
                    .update(payload)
                    .eq('id', editingId);
                if (updateError) throw updateError;
            } else {
                const isFirst = addresses.length === 0;
                if (isFirst || payload.is_default) {
                    payload.is_default = true;
                    if (!isFirst) {
                        await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id);
                    }
                }
                const { error: insertError } = await supabase.from('addresses').insert([payload]);
                if (insertError) throw insertError;
            }

            Alert.alert('Success', editingId ? 'Address updated successfully' : 'Address added successfully');
            setIsAdding(false);
            setEditingId(null);
            setFormData({ title: 'Home', address: '', city: '', state: '', phone: '', latitude: null, longitude: null, isDefault: false });
            fetchAddresses();

        } catch (error) {
            Alert.alert('Error', error.message || 'Could not save address');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = (id) => {
        Alert.alert('Delete Address', 'Are you sure you want to remove this shipping address?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', 
                style: 'destructive', 
                onPress: async () => {
                    try {
                        const { error } = await supabase.from('addresses').delete().eq('id', id);
                        if (error) throw error;
                        fetchAddresses();
                    } catch (error) {
                        Alert.alert('Error', 'Could not delete address');
                    }
                }
            }
        ]);
    };

    const handleSetDefault = async (id) => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id);
            const { error } = await supabase.from('addresses').update({ is_default: true }).eq('id', id);

            if (error) throw error;
            fetchAddresses();
        } catch (error) {
            Alert.alert('Error', 'Could not update default address');
            setLoading(false);
        }
    };

    const getIcon = (title) => {
        const t = (title || '').toLowerCase();
        if (t.includes('home')) return 'home';
        if (t.includes('office') || t.includes('work')) return 'business';
        if (t.includes('shop') || t.includes('store')) return 'storefront';
        if (t.includes('warehouse')) return 'cube';
        if (t.includes('school')) return 'school';
        return 'location';
    };

    const openModal = (type) => {
        if (type === 'lga' && !formData.state) {
            Alert.alert('Select State First', 'Please choose a Nigerian State before selecting the Local Government.');
            return;
        }
        setSearchQuery('');
        setModalType(type);
        setModalVisible(true);
    };

    const handleSelect = (item) => {
        if (modalType === 'state') {
            setFormData(prev => ({ 
                ...prev, 
                state: item.state, 
                city: '' // Clear LGA on state switch
            }));
        } else {
            setFormData(prev => ({ 
                ...prev, 
                city: item 
            }));
        }
        setModalVisible(false);
    };

    const filteredItems = useMemo(() => {
        const query = (searchQuery || '').toLowerCase().trim();
        if (modalType === 'state') {
            if (!query) return NIGERIA_DATA;
            return NIGERIA_DATA.filter(s => s.state.toLowerCase().includes(query));
        }
        if (modalType === 'lga') {
            const stateData = NIGERIA_DATA.find(s => s.state === formData.state);
            const lgas = stateData ? stateData.lgas : [];
            if (!query) return lgas;
            return lgas.filter(l => l.toLowerCase().includes(query));
        }
        return [];
    }, [modalType, searchQuery, formData.state]);

    return (
        <View style={localStyles.container}>
            <StatusBar barStyle="light-content" backgroundColor={NAVY} />

            {/* ── HEADER ── */}
            <View style={localStyles.header}>
                <SafeAreaView>
                    <View style={localStyles.headerRow}>
                        <TouchableOpacity onPress={handleBack} style={localStyles.backBtn} activeOpacity={0.7}>
                            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
                        </TouchableOpacity>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={localStyles.headerTitle}>Shipping Addresses</Text>
                            <Text style={localStyles.headerSub}>Manage your delivery locations & Local Governments</Text>
                        </View>
                        {!isAdding && (
                            <TouchableOpacity 
                                onPress={() => {
                                    setEditingId(null);
                                    setFormData({ title: 'Home', address: '', city: '', state: '', phone: '', latitude: null, longitude: null, isDefault: false });
                                    setIsAdding(true);
                                }}
                                style={localStyles.headerAddBtn}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="add" size={18} color={NAVY} />
                                <Text style={localStyles.headerAddBtnText}>Add</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </SafeAreaView>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView
                    contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    showsVerticalScrollIndicator={false}
                >
                    {isAdding ? (
                        <View style={localStyles.formCard}>
                            <View style={localStyles.formHeader}>
                                <View style={localStyles.formHeaderIcon}>
                                    <Ionicons name={editingId ? "create-outline" : "add-circle-outline"} size={22} color={GOLD} />
                                </View>
                                <View>
                                    <Text style={localStyles.formTitle}>{editingId ? 'Edit Shipping Address' : 'New Shipping Address'}</Text>
                                    <Text style={localStyles.formSub}>Accurate LGA & street ensures fast distance routing</Text>
                                </View>
                            </View>

                            {/* ── GPS AUTO-DETECT BUTTON ── */}
                            <TouchableOpacity
                                onPress={handleUseLocation}
                                disabled={locating}
                                activeOpacity={0.8}
                                style={localStyles.gpsDetectCard}
                            >
                                <View style={localStyles.gpsIconCircle}>
                                    {locating ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                        <Ionicons name="navigate" size={18} color="#FFFFFF" />
                                    )}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={localStyles.gpsTitle}>
                                        {locating ? 'Detecting GPS Coordinates...' : 'Detect Current Location via GPS'}
                                    </Text>
                                    <Text style={localStyles.gpsSub}>
                                        Auto-fills street, LGA & State for real-world road calculation
                                    </Text>
                                    {formData.latitude && formData.longitude ? (
                                        <View style={localStyles.gpsCoordsBadge}>
                                            <Ionicons name="checkmark-circle" size={13} color="#10B981" />
                                            <Text style={localStyles.gpsCoordsText}>
                                                GPS: {formData.latitude.toFixed(4)}, {formData.longitude.toFixed(4)}
                                            </Text>
                                        </View>
                                    ) : null}
                                </View>
                            </TouchableOpacity>

                            {/* ── ADDRESS LABEL / TITLE CHIPS ── */}
                            <View style={localStyles.inputSection}>
                                <Text style={localStyles.fieldLabel}>Address Label</Text>
                                <View style={localStyles.chipsContainer}>
                                    {QUICK_TITLES.map((t) => {
                                        const isSelected = formData.title.toLowerCase() === t.toLowerCase();
                                        return (
                                            <TouchableOpacity
                                                key={t}
                                                onPress={() => setFormData({ ...formData, title: t })}
                                                style={[localStyles.chip, isSelected && localStyles.chipSelected]}
                                            >
                                                <Ionicons 
                                                    name={getIcon(t)} 
                                                    size={14} 
                                                    color={isSelected ? NAVY : '#64748B'} 
                                                />
                                                <Text style={[localStyles.chipText, isSelected && localStyles.chipTextSelected]}>
                                                    {t}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>

                            {/* ── STATE & LOCAL GOVERNMENT AREA (LGA) SELECTORS ── */}
                            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                                {/* State Picker */}
                                <View style={{ flex: 1 }}>
                                    <Text style={localStyles.fieldLabel}>State *</Text>
                                    <TouchableOpacity 
                                        style={localStyles.selectInput} 
                                        onPress={() => openModal('state')}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="map-outline" size={18} color={GOLD} />
                                        <Text style={[localStyles.selectInputText, { color: formData.state ? '#0F172A' : '#94A3B8' }]} numberOfLines={1}>
                                            {formData.state || 'Select State'}
                                        </Text>
                                        <Ionicons name="chevron-down" size={16} color="#94A3B8" />
                                    </TouchableOpacity>
                                </View>

                                {/* Local Government (LGA) Picker */}
                                <View style={{ flex: 1 }}>
                                    <Text style={localStyles.fieldLabel}>Local Gov (LGA) *</Text>
                                    <TouchableOpacity 
                                        style={[localStyles.selectInput, !formData.state && { opacity: 0.6 }]} 
                                        onPress={() => openModal('lga')}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="business-outline" size={18} color="#2563EB" />
                                        <Text style={[localStyles.selectInputText, { color: formData.city ? '#0F172A' : '#94A3B8' }]} numberOfLines={1}>
                                            {formData.city || 'Select LGA'}
                                        </Text>
                                        <Ionicons name="chevron-down" size={16} color="#94A3B8" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* ── FULL STREET ADDRESS ── */}
                            <View style={localStyles.inputSection}>
                                <Text style={localStyles.fieldLabel}>Street Address / Area *</Text>
                                <View style={localStyles.textInputContainer}>
                                    <Ionicons name="location-outline" size={18} color="#64748B" style={{ marginTop: 12 }} />
                                    <TextInput
                                        style={localStyles.multilineInput}
                                        multiline
                                        numberOfLines={3}
                                        value={formData.address}
                                        onChangeText={t => setFormData({ ...formData, address: t })}
                                        placeholder="e.g. No. 14 Bompai Road, Commercial District"
                                        placeholderTextColor="#94A3B8"
                                    />
                                </View>
                            </View>

                            {/* ── PHONE NUMBER ── */}
                            <View style={localStyles.inputSection}>
                                <Text style={localStyles.fieldLabel}>Receiver Phone Number *</Text>
                                <View style={localStyles.textInputRow}>
                                    <Ionicons name="call-outline" size={18} color="#64748B" />
                                    <TextInput
                                        style={localStyles.singleInput}
                                        value={formData.phone}
                                        onChangeText={t => setFormData({ ...formData, phone: t })}
                                        keyboardType="phone-pad"
                                        placeholder="e.g. 0803 123 4567"
                                        placeholderTextColor="#94A3B8"
                                    />
                                </View>
                            </View>

                            {/* ── DEFAULT ADDRESS TOGGLE ── */}
                            <View style={localStyles.toggleRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={localStyles.toggleTitle}>Set as Default Address</Text>
                                    <Text style={localStyles.toggleSub}>Automatically select this address on checkout</Text>
                                </View>
                                <Switch
                                    value={formData.isDefault}
                                    onValueChange={v => setFormData({ ...formData, isDefault: v })}
                                    trackColor={{ false: '#E2E8F0', true: GOLD }}
                                    thumbColor={formData.isDefault ? NAVY : '#FFFFFF'}
                                />
                            </View>

                            {/* ── ACTION BUTTONS ── */}
                            <View style={localStyles.formActions}>
                                <TouchableOpacity 
                                    style={localStyles.cancelBtn} 
                                    onPress={() => setIsAdding(false)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={localStyles.cancelBtnText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[localStyles.saveBtn, submitting && { opacity: 0.7 }]}
                                    onPress={handleAddAddress}
                                    disabled={submitting}
                                    activeOpacity={0.8}
                                >
                                    {submitting ? (
                                        <ActivityIndicator color={NAVY} size="small" />
                                    ) : (
                                        <>
                                            <Ionicons name="checkmark-circle" size={18} color={NAVY} />
                                            <Text style={localStyles.saveBtnText}>
                                                {editingId ? 'Update Address' : 'Save Address'}
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <>
                            {loading ? (
                                <ActivityIndicator size="large" color={NAVY} style={{ marginTop: 40 }} />
                            ) : addresses.length === 0 ? (
                                <View style={localStyles.emptyStateContainer}>
                                    <View style={localStyles.emptyIconCircle}>
                                        <Ionicons name="location-outline" size={44} color="#94A3B8" />
                                    </View>
                                    <Text style={localStyles.emptyTitle}>No Shipping Addresses</Text>
                                    <Text style={localStyles.emptySub}>Add your delivery address to calculate accurate road distance and delivery fees.</Text>
                                    <TouchableOpacity 
                                        style={localStyles.emptyAddBtn} 
                                        onPress={() => setIsAdding(true)}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="add" size={18} color={NAVY} />
                                        <Text style={localStyles.emptyAddBtnText}>Add Your First Address</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                addresses.map((addr) => {
                                    const lgaDisplay = addr.lga || addr.city;
                                    const hasGps = Boolean(addr.latitude && addr.longitude);

                                    return (
                                        <View key={addr.id} style={[localStyles.addressCard, addr.is_default && localStyles.defaultCardBorder]}>
                                            {/* Ribbon for Default Address */}
                                            {addr.is_default ? (
                                                <View style={localStyles.defaultRibbon}>
                                                    <Ionicons name="star" size={11} color={NAVY} />
                                                    <Text style={localStyles.defaultRibbonText}>DEFAULT</Text>
                                                </View>
                                            ) : null}

                                            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                                                {/* Category Icon */}
                                                <View style={localStyles.addressIconBox}>
                                                    <Ionicons name={getIcon(addr.title)} size={20} color={NAVY} />
                                                </View>

                                                <View style={{ flex: 1, marginLeft: 12 }}>
                                                    {/* Title & LGA Badge */}
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                                                        <Text style={localStyles.cardTitle}>{addr.title}</Text>
                                                        {lgaDisplay ? (
                                                            <View style={localStyles.lgaBadge}>
                                                                <Ionicons name="business" size={11} color="#2563EB" />
                                                                <Text style={localStyles.lgaBadgeText}>LGA: {lgaDisplay}</Text>
                                                            </View>
                                                        ) : null}
                                                        {hasGps ? (
                                                            <View style={localStyles.gpsBadge}>
                                                                <Ionicons name="location" size={11} color="#10B981" />
                                                                <Text style={localStyles.gpsBadgeText}>GPS Verified</Text>
                                                            </View>
                                                        ) : null}
                                                    </View>

                                                    {/* Street */}
                                                    <Text style={localStyles.cardAddressText}>{addr.address}</Text>
                                                    <Text style={localStyles.cardStateText}>{lgaDisplay ? `${lgaDisplay}, ` : ''}{addr.state} State, Nigeria</Text>

                                                    {/* Phone */}
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                                                        <Ionicons name="call-outline" size={13} color="#64748B" />
                                                        <Text style={localStyles.cardPhone}>{addr.phone}</Text>
                                                    </View>

                                                    {/* Actions Row */}
                                                    <View style={localStyles.cardActionsRow}>
                                                        <TouchableOpacity 
                                                            onPress={() => handleEdit(addr)}
                                                            style={localStyles.cardEditBtn}
                                                            activeOpacity={0.7}
                                                        >
                                                            <Ionicons name="pencil-outline" size={13} color="#2563EB" />
                                                            <Text style={localStyles.cardEditBtnText}>Edit</Text>
                                                        </TouchableOpacity>

                                                        {!addr.is_default && (
                                                            <TouchableOpacity 
                                                                onPress={() => handleSetDefault(addr.id)}
                                                                style={localStyles.cardSetDefaultBtn}
                                                                activeOpacity={0.7}
                                                            >
                                                                <Ionicons name="checkmark-outline" size={13} color="#059669" />
                                                                <Text style={localStyles.cardSetDefaultBtnText}>Set Default</Text>
                                                            </TouchableOpacity>
                                                        )}

                                                        <TouchableOpacity 
                                                            onPress={() => handleDelete(addr.id)}
                                                            style={localStyles.cardDeleteBtn}
                                                            activeOpacity={0.7}
                                                        >
                                                            <Ionicons name="trash-outline" size={13} color="#EF4444" />
                                                            <Text style={localStyles.cardDeleteBtnText}>Delete</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            </View>
                                        </View>
                                    );
                                })
                            )}
                        </>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>

            {/* ── SEARCHABLE SELECTION BOTTOM SHEET MODAL (STATE & LGA) ── */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={localStyles.modalOverlay}>
                    <View style={localStyles.modalSheet}>
                        <View style={localStyles.modalHeader}>
                            <View>
                                <Text style={localStyles.modalTitle}>
                                    Select {modalType === 'state' ? 'Nigerian State' : `Local Government (${formData.state})`}
                                </Text>
                                <Text style={localStyles.modalSub}>
                                    {modalType === 'state' ? 'Choose state to inspect and match LGA rates' : 'Select exact Local Government Area (LGA)'}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={localStyles.modalCloseBtn}>
                                <Ionicons name="close" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        {/* Search Box */}
                        <View style={localStyles.modalSearchRow}>
                            <Ionicons name="search" size={18} color="#94A3B8" />
                            <TextInput
                                style={localStyles.modalSearchInput}
                                placeholder={modalType === 'state' ? 'Search state name...' : 'Search LGA name...'}
                                placeholderTextColor="#94A3B8"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoFocus={true}
                            />
                            {searchQuery ? (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <Ionicons name="close-circle" size={18} color="#94A3B8" />
                                </TouchableOpacity>
                            ) : null}
                        </View>

                        {/* Items Count Tag */}
                        <View style={{ paddingHorizontal: 4, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#94A3B8' }}>
                                {filteredItems.length} {modalType === 'state' ? 'States Available' : 'LGAs in State'}
                            </Text>
                        </View>

                        {/* List */}
                        <FlatList
                            data={filteredItems}
                            keyExtractor={(item, index) => (modalType === 'state' ? item.state : item) + index}
                            keyboardShouldPersistTaps="handled"
                            renderItem={({ item }) => {
                                const itemName = modalType === 'state' ? item.state : item;
                                const isSelected = modalType === 'state' 
                                    ? formData.state === itemName 
                                    : formData.city === itemName;

                                return (
                                    <TouchableOpacity
                                        style={[localStyles.modalItem, isSelected && localStyles.modalItemSelected]}
                                        onPress={() => handleSelect(item)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                            <Ionicons 
                                                name={modalType === 'state' ? 'map-outline' : 'business-outline'} 
                                                size={18} 
                                                color={isSelected ? GOLD : '#64748B'} 
                                            />
                                            <Text style={[localStyles.modalItemText, isSelected && localStyles.modalItemTextSelected]}>
                                                {itemName}
                                            </Text>
                                        </View>
                                        {isSelected ? (
                                            <Ionicons name="checkmark-circle" size={20} color={GOLD} />
                                        ) : (
                                            <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                                        )}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const localStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC'
    },
    header: {
        backgroundColor: NAVY,
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 6 : 12,
        paddingBottom: 16,
        borderBottomWidth: 1.5,
        borderBottomColor: GOLD
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    backBtn: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: -0.3
    },
    headerSub: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 2
    },
    headerAddBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: GOLD,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 10
    },
    headerAddBtnText: {
        fontSize: 12,
        fontWeight: '900',
        color: NAVY
    },
    formCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 22,
        padding: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2
    },
    formHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    formHeaderIcon: {
        width: 42,
        height: 42,
        borderRadius: 12,
        backgroundColor: 'rgba(217, 167, 58, 0.12)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    formTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: NAVY
    },
    formSub: {
        fontSize: 11.5,
        color: '#64748B',
        marginTop: 2
    },
    gpsDetectCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: NAVY,
        borderRadius: 16,
        padding: 14,
        marginBottom: 18,
        borderWidth: 1,
        borderColor: GOLD
    },
    gpsIconCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(217, 167, 58, 0.25)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    gpsTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#FFFFFF'
    },
    gpsSub: {
        fontSize: 10.5,
        color: '#94A3B8',
        marginTop: 2
    },
    gpsCoordsBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2.5,
        borderRadius: 6,
        marginTop: 6
    },
    gpsCoordsText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#10B981'
    },
    inputSection: {
        marginBottom: 16
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: '#334155',
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.3
    },
    chipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    chipSelected: {
        backgroundColor: GOLD,
        borderColor: GOLD
    },
    chipText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#475569'
    },
    chipTextSelected: {
        color: NAVY,
        fontWeight: '900'
    },
    selectInput: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8FAFC',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 13
    },
    selectInputText: {
        fontSize: 13.5,
        fontWeight: '700',
        flex: 1,
        marginHorizontal: 8
    },
    textInputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        backgroundColor: '#F8FAFC',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 4
    },
    multilineInput: {
        flex: 1,
        minHeight: 64,
        textAlignVertical: 'top',
        fontSize: 13.5,
        color: '#0F172A',
        fontWeight: '600',
        paddingTop: 10
    },
    textInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#F8FAFC',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12
    },
    singleInput: {
        flex: 1,
        fontSize: 13.5,
        color: '#0F172A',
        fontWeight: '600'
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8FAFC',
        padding: 14,
        borderRadius: 14,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    toggleTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: NAVY
    },
    toggleSub: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 2
    },
    formActions: {
        flexDirection: 'row',
        gap: 12
    },
    cancelBtn: {
        flex: 1,
        backgroundColor: '#F1F5F9',
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    cancelBtnText: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#64748B'
    },
    saveBtn: {
        flex: 2,
        backgroundColor: GOLD,
        paddingVertical: 14,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        shadowColor: GOLD,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 3
    },
    saveBtnText: {
        fontSize: 14,
        fontWeight: '900',
        color: NAVY
    },
    emptyStateContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        paddingHorizontal: 20
    },
    emptyIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: NAVY,
        marginBottom: 6
    },
    emptySub: {
        fontSize: 13,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 20
    },
    emptyAddBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: GOLD,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 14
    },
    emptyAddBtnText: {
        fontSize: 13.5,
        fontWeight: '900',
        color: NAVY
    },
    addressCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
        position: 'relative',
        overflow: 'hidden'
    },
    defaultCardBorder: {
        borderColor: GOLD
    },
    defaultRibbon: {
        position: 'absolute',
        top: 0,
        right: 0,
        backgroundColor: GOLD,
        paddingHorizontal: 10,
        paddingVertical: 3.5,
        borderBottomLeftRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4
    },
    defaultRibbonText: {
        fontSize: 9.5,
        fontWeight: '900',
        color: NAVY,
        letterSpacing: 0.5
    },
    addressIconBox: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center'
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: NAVY
    },
    lgaBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 0.5,
        borderColor: '#BFDBFE'
    },
    lgaBadgeText: {
        fontSize: 10.5,
        fontWeight: '800',
        color: '#1D4ED8'
    },
    gpsBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 0.5,
        borderColor: '#A7F3D0'
    },
    gpsBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#059669'
    },
    cardAddressText: {
        fontSize: 13.5,
        color: '#334155',
        fontWeight: '600',
        marginTop: 4,
        lineHeight: 18
    },
    cardStateText: {
        fontSize: 12.5,
        color: '#64748B',
        fontWeight: '500',
        marginTop: 2
    },
    cardPhone: {
        fontSize: 12.5,
        color: '#334155',
        fontWeight: '700'
    },
    cardActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9'
    },
    cardEditBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4
    },
    cardEditBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#2563EB'
    },
    cardSetDefaultBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4
    },
    cardSetDefaultBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#059669'
    },
    cardDeleteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
        marginLeft: 'auto'
    },
    cardDeleteBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#EF4444'
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(14, 26, 46, 0.65)',
        justifyContent: 'flex-end'
    },
    modalSheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 20,
        maxHeight: '80%',
        minHeight: '60%'
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '900',
        color: NAVY
    },
    modalSub: {
        fontSize: 11.5,
        color: '#64748B',
        marginTop: 2
    },
    modalCloseBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center'
    },
    modalSearchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        marginBottom: 10
    },
    modalSearchInput: {
        flex: 1,
        fontSize: 14,
        color: NAVY,
        fontWeight: '600'
    },
    modalItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC'
    },
    modalItemSelected: {
        backgroundColor: 'rgba(217, 167, 58, 0.12)'
    },
    modalItemText: {
        fontSize: 14.5,
        color: '#334155',
        fontWeight: '600'
    },
    modalItemTextSelected: {
        color: NAVY,
        fontWeight: '900'
    }
});
