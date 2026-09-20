import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    View, 
    Text, 
    TouchableOpacity, 
    ScrollView, 
    SafeAreaView, 
    TextInput, 
    Alert, 
    StyleSheet, 
    ActivityIndicator, 
    RefreshControl, 
    KeyboardAvoidingView, 
    Platform, 
    Switch, 
    Modal, 
    FlatList,
    StatusBar,
    Share
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../lib/supabase';
import { NIGERIA_DATA } from '../data/nigeriaData';
import { NIGERIA_STATE_CENTROIDS, NIGERIA_LGA_CENTROIDS } from '../services/shippingService';

const NAVY = '#0E1A2E';
const GOLD = '#D9A73A';
const QUICK_TITLES = ['Home', 'Office', 'Shop', 'Warehouse', 'Family'];

export const AddressPage = ({ navigation, onBack }) => {
    const handleBack = () => {
        if (onBack) onBack();
        else navigation.goBack();
    };

    const [addresses, setAddresses] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [locating, setLocating] = useState(false);
    const [activeUser, setActiveUser] = useState(null);

    // Modal State for State & LGA Selectors
    const [modalVisible, setModalVisible] = useState(false);
    const [modalType, setModalType] = useState(null); // 'state' or 'lga'
    const [searchQuery, setSearchQuery] = useState('');

    // Form State (Clean & Ergonomic)
    const [formData, setFormData] = useState({
        title: 'Home',
        address: '',
        landmark: '',
        city: '', // Holds LGA
        state: '',
        phone: '',
        latitude: null,
        longitude: null,
        isDefault: false
    });

    const getStorageKey = (uid) => `@user_addresses_${uid || 'guest'}`;

    useEffect(() => {
        initData();
    }, []);

    const initData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            setActiveUser(user);
            await fetchAddresses(user);
        } catch (e) {
            console.log('Error initializing addresses:', e);
            setLoading(false);
        }
    };

    /**
     * Bulletproof Fetch: Fetches from Supabase and merges with local storage.
     * Guaranteed to work even if the 'addresses' table has not yet been created in Supabase!
     */
    const fetchAddresses = async (userParam) => {
        setLoading(true);
        const user = userParam || activeUser;
        const uid = user?.id || 'guest';
        let mergedList = [];

        // 1. Load from local AsyncStorage & window.localStorage first
        try {
            let localRaw = await AsyncStorage.getItem(getStorageKey(uid));
            if (!localRaw && typeof window !== 'undefined' && window.localStorage) {
                localRaw = window.localStorage.getItem(getStorageKey(uid));
            }
            if (!localRaw) {
                localRaw = await AsyncStorage.getItem('@user_addresses_guest');
                if (!localRaw && typeof window !== 'undefined' && window.localStorage) {
                    localRaw = window.localStorage.getItem('@user_addresses_guest');
                }
            }
            if (localRaw) {
                const parsed = JSON.parse(localRaw);
                if (Array.isArray(parsed) && parsed.length > 0) mergedList = parsed;
            }
            if (mergedList.length === 0) {
                let lastSelected = await AsyncStorage.getItem('@abumafhal_last_selected_address');
                if (!lastSelected && typeof window !== 'undefined' && window.localStorage) {
                    lastSelected = window.localStorage.getItem('@abumafhal_last_selected_address');
                }
                if (lastSelected) {
                    const parsedLast = JSON.parse(lastSelected);
                    if (parsedLast && parsedLast.address) mergedList = [parsedLast];
                }
            }
        } catch (e) {
            console.log('Storage read error in AddressPage:', e);
        }

        // 2. Attempt to query Supabase 'addresses' table
        if (user) {
            try {
                const { data: sbData, error: sbError } = await supabase
                    .from('addresses')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('is_default', { ascending: false });

                if (!sbError && Array.isArray(sbData) && sbData.length > 0) {
                    // Merge Supabase entries with local cache
                    const idMap = new Map();
                    sbData.forEach(item => idMap.set(item.id, item));
                    mergedList.forEach(item => {
                        if (!idMap.has(item.id)) idMap.set(item.id, item);
                    });
                    mergedList = Array.from(idMap.values());
                    await AsyncStorage.setItem(getStorageKey(uid), JSON.stringify(mergedList));
                    if (typeof window !== 'undefined' && window.localStorage) {
                        window.localStorage.setItem(getStorageKey(uid), JSON.stringify(mergedList));
                    }
                }
            } catch (err) {
                console.log('Supabase addresses table query skipped/fallback:', err?.message || err);
            }
        }

        // 3. Fallback to profile address if still empty
        if (mergedList.length === 0 && user) {
            try {
                const { data: prof } = await supabase
                    .from('profiles')
                    .select('address, state, city, lga, phone, phone_number')
                    .eq('id', user.id)
                    .maybeSingle();

                if (prof && prof.address) {
                    const fallbackItem = {
                        id: 'profile_default',
                        user_id: user.id,
                        title: 'Home',
                        address: prof.address,
                        city: prof.city || prof.lga || '',
                        lga: prof.lga || prof.city || '',
                        state: prof.state || 'Yobe',
                        phone: prof.phone || prof.phone_number || '',
                        is_default: true,
                        created_at: new Date().toISOString()
                    };
                    mergedList = [fallbackItem];
                    await AsyncStorage.setItem(getStorageKey(uid), JSON.stringify(mergedList));
                    if (typeof window !== 'undefined' && window.localStorage) {
                        window.localStorage.setItem(getStorageKey(uid), JSON.stringify(mergedList));
                    }
                }
            } catch (err) {
                console.log('Profile fallback address error:', err);
            }
        }

        setAddresses(mergedList);
        setLoading(false);
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchAddresses().then(() => setRefreshing(false));
    }, [activeUser]);

    const handleEdit = (addr) => {
        setFormData({
            title: addr.title || 'Home',
            address: addr.address || '',
            landmark: addr.landmark || '',
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

    /**
     * Rock-Solid GPS Detection:
     * 1. Requests permission.
     * 2. Checks cached position first for instantaneous response.
     * 3. Falls back to balanced position query with timeout.
     * 4. Reverse geocodes with dual engine (Expo Location + OpenStreetMap Nominatim).
     * 5. Sets latitude & longitude in formData unconditionally.
     */
    const handleUseLocation = async () => {
        setLocating(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Please grant location permission to auto-detect your delivery address.');
                setLocating(false);
                return;
            }

            // Step 1: Try last known location for fast response
            let loc = await Location.getLastKnownPositionAsync({ maxAge: 60000 });

            // Step 2: If no recent cached location, query current position with balanced accuracy
            if (!loc || !loc.coords) {
                loc = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                    timeInterval: 6000,
                    mayShowUserSettingsDialog: true
                });
            }

            if (!loc || !loc.coords) {
                throw new Error('Unable to retrieve device GPS coordinates');
            }

            const { latitude, longitude } = loc.coords;

            // Set coordinates into form state immediately
            setFormData(prev => ({
                ...prev,
                latitude,
                longitude
            }));

            // Step 3: Reverse Geocoding
            let detectedState = '';
            let detectedLga = '';
            let streetName = '';

            try {
                const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
                if (geo && geo.length > 0) {
                    const item = geo[0];
                    if (item.street) streetName = `${item.name ? item.name + ', ' : ''}${item.street}`;
                    else if (item.name) streetName = item.name;

                    const region = (item.region || '').replace(/ state/i, '').trim().toLowerCase();
                    const subregion = (item.subregion || item.city || item.district || '').trim().toLowerCase();

                    // Match State
                    const foundState = NIGERIA_DATA.find(s => s.state.toLowerCase() === region);
                    if (foundState) {
                        detectedState = foundState.state;
                        // Match LGA
                        const foundLga = foundState.lgas.find(l => 
                            l.toLowerCase() === subregion || 
                            subregion.includes(l.toLowerCase())
                        );
                        if (foundLga) detectedLga = foundLga;
                    }
                }
            } catch (geoErr) {
                console.log('Expo reverse geocode notice:', geoErr?.message);
            }

            // Step 4: Fallback to OpenStreetMap Nominatim if LGA/State were not resolved
            if (!detectedState || !detectedLga) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 3500);
                    const osmRes = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1`,
                        { 
                            signal: controller.signal,
                            headers: { 'User-Agent': 'AbuMafhalMarketplace/1.0' }
                        }
                    );
                    clearTimeout(timeoutId);
                    if (osmRes.ok) {
                        const osmData = await osmRes.json();
                        const addr = osmData.address || {};
                        const stateStr = (addr.state || '').replace(/ state/i, '').trim().toLowerCase();
                        const lgaStr = (addr.county || addr.city || addr.town || addr.municipality || '').trim().toLowerCase();

                        const fState = NIGERIA_DATA.find(s => s.state.toLowerCase() === stateStr);
                        if (fState) {
                            detectedState = fState.state;
                            const fLga = fState.lgas.find(l => l.toLowerCase() === lgaStr || lgaStr.includes(l.toLowerCase()));
                            if (fLga) detectedLga = fLga;
                        }
                        if (!streetName && osmData.display_name) {
                            streetName = osmData.display_name.split(',').slice(0, 2).join(',').trim();
                        }
                    }
                } catch (osmErr) {
                    console.log('OSM fallback notice:', osmErr?.message);
                }
            }

            setFormData(prev => ({
                ...prev,
                latitude,
                longitude,
                state: detectedState || prev.state,
                city: detectedLga || prev.city,
                address: streetName ? (prev.address ? prev.address : streetName) : prev.address
            }));

            Alert.alert(
                'GPS Location Detected',
                `Coordinates: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}${detectedState ? `\nState: ${detectedState}` : ''}${detectedLga ? `\nLGA: ${detectedLga}` : ''}`
            );

        } catch (error) {
            console.log('GPS error:', error);
            Alert.alert(
                'GPS Signal Weak',
                'Could not detect current GPS coordinates automatically. Please make sure location is enabled on your phone or select your State and LGA manually.'
            );
        } finally {
            setLocating(false);
        }
    };

    /**
     * Bulletproof Save:
     * Saves to Supabase (if table exists) AND guarantees persistent save to AsyncStorage & Profiles.
     * Prevents user from getting stuck with "Could not find table in schema cache" error.
     */
    const handleAddAddress = async () => {
        if (!formData.title || !formData.address || !formData.city || !formData.state || !formData.phone) {
            Alert.alert('Incomplete Details', 'Please enter your State, Local Government Area (LGA), street address, and phone number.');
            return;
        }

        try {
            setSubmitting(true);
            const { data: { user } } = await supabase.auth.getUser();
            const uid = user?.id || activeUser?.id || 'guest';

            // Coordinates: Use detected GPS or fall back to LGA/State centroid
            let lat = formData.latitude;
            let lon = formData.longitude;
            if (!lat || !lon) {
                if (formData.city && NIGERIA_LGA_CENTROIDS?.[formData.city]) {
                    lat = NIGERIA_LGA_CENTROIDS[formData.city].lat;
                    lon = NIGERIA_LGA_CENTROIDS[formData.city].lon;
                } else if (formData.state && NIGERIA_STATE_CENTROIDS?.[formData.state]) {
                    lat = NIGERIA_STATE_CENTROIDS[formData.state].lat;
                    lon = NIGERIA_STATE_CENTROIDS[formData.state].lon;
                }
            }

            const isFirst = addresses.length === 0;
            const willBeDefault = isFirst || formData.isDefault;

            const fullAddressText = formData.landmark 
                ? `${formData.address.trim()} (Near: ${formData.landmark.trim()})`
                : formData.address.trim();

            const newRecord = {
                id: editingId || `addr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                user_id: uid,
                title: formData.title,
                address: fullAddressText,
                city: formData.city, // LGA
                lga: formData.city,
                state: formData.state,
                phone: formData.phone.trim(),
                latitude: lat ? parseFloat(lat) : null,
                longitude: lon ? parseFloat(lon) : null,
                is_default: willBeDefault,
                created_at: new Date().toISOString()
            };

            // Update Local Storage
            let updatedList = [...addresses];
            if (editingId) {
                updatedList = updatedList.map(a => {
                    if (a.id === editingId) return newRecord;
                    if (willBeDefault) return { ...a, is_default: false };
                    return a;
                });
            } else {
                if (willBeDefault) {
                    updatedList = updatedList.map(a => ({ ...a, is_default: false }));
                }
                updatedList.unshift(newRecord);
            }

            // Persist to local storage immediately across all fallback keys
            await AsyncStorage.setItem(getStorageKey(uid), JSON.stringify(updatedList));
            await AsyncStorage.setItem('@user_addresses_guest', JSON.stringify(updatedList));
            await AsyncStorage.setItem('@abumafhal_last_selected_address', JSON.stringify(newRecord));
            if (typeof window !== 'undefined' && window.localStorage) {
                try {
                    window.localStorage.setItem(getStorageKey(uid), JSON.stringify(updatedList));
                    window.localStorage.setItem('@user_addresses_guest', JSON.stringify(updatedList));
                    window.localStorage.setItem('@abumafhal_last_selected_address', JSON.stringify(newRecord));
                } catch (_) {}
            }

            // Sync with Supabase: Try RPC first (SECURITY DEFINER), fallback to direct tables
            const sbPayload = {
                id: (editingId && !editingId.startsWith('addr_') && !editingId.startsWith('profile_')) ? editingId : undefined,
                user_id: user?.id || null,
                title: newRecord.title,
                address: newRecord.address,
                landmark: formData.landmark ? formData.landmark.trim() : null,
                city: newRecord.city,
                lga: newRecord.lga || newRecord.city,
                state: newRecord.state,
                phone: newRecord.phone,
                latitude: newRecord.latitude,
                longitude: newRecord.longitude,
                is_default: newRecord.is_default
            };

            let savedViaRpc = false;
            try {
                const { data: rpcData, error: rpcErr } = await supabase.rpc('save_user_address', {
                    address_payload: sbPayload
                });
                if (!rpcErr && rpcData) {
                    savedViaRpc = true;
                    if (rpcData.id) {
                        newRecord.id = rpcData.id;
                        const finalUpdated = updatedList.map(a => a.id === newRecord.id ? { ...a, id: rpcData.id } : a);
                        await AsyncStorage.setItem(getStorageKey(uid), JSON.stringify(finalUpdated));
                    }
                }
            } catch (_) {}

            if (!savedViaRpc && user) {
                try {
                    if (editingId && !editingId.startsWith('addr_') && !editingId.startsWith('profile_')) {
                        await supabase.from('addresses').update(sbPayload).eq('id', editingId);
                    } else {
                        await supabase.from('addresses').insert([sbPayload]);
                    }
                } catch (sbErr) {
                    console.log('Direct addresses insert notice:', sbErr?.message);
                }

                // Also update profile record for convenience
                if (willBeDefault) {
                    try {
                        await supabase.from('profiles').update({
                            address: fullAddressText,
                            state: formData.state,
                            city: formData.city,
                            phone: formData.phone.trim()
                        }).eq('id', user.id);
                    } catch (pErr) {
                        console.log('Profile sync notice:', pErr?.message);
                    }
                }
            }

            Alert.alert(
                'Success', 
                editingId ? 'Shipping address updated successfully.' : 'Shipping address saved successfully!'
            );

            setIsAdding(false);
            setEditingId(null);
            setFormData({
                title: 'Home',
                address: '',
                landmark: '',
                city: '',
                state: '',
                phone: '',
                latitude: null,
                longitude: null,
                isDefault: false
            });

            setAddresses(updatedList);

        } catch (error) {
            console.error('Save address error:', error);
            Alert.alert('Save Error', error.message || 'Could not save address. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = (id) => {
        Alert.alert('Delete Address', 'Are you sure you want to remove this delivery address?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', 
                style: 'destructive', 
                onPress: async () => {
                    try {
                        const uid = activeUser?.id || 'guest';
                        const updated = addresses.filter(a => a.id !== id);
                        await AsyncStorage.setItem(getStorageKey(uid), JSON.stringify(updated));
                        setAddresses(updated);

                        if (activeUser && !id.startsWith('addr_') && !id.startsWith('profile_')) {
                            supabase.from('addresses').delete().eq('id', id).catch(e => console.log('SB delete notice:', e));
                        }
                    } catch (error) {
                        Alert.alert('Error', 'Could not delete address');
                    }
                }
            }
        ]);
    };

    const handleSetDefault = async (id) => {
        try {
            const uid = activeUser?.id || 'guest';
            const updated = addresses.map(a => ({
                ...a,
                is_default: a.id === id
            }));
            await AsyncStorage.setItem(getStorageKey(uid), JSON.stringify(updated));
            setAddresses(updated);

            const target = updated.find(a => a.id === id);
            if (activeUser && target) {
                if (!id.startsWith('addr_') && !id.startsWith('profile_')) {
                    supabase.from('addresses').update({ is_default: true }).eq('id', id).catch(e => console.log('SB set default notice:', e));
                }
                supabase.from('profiles').update({
                    address: target.address,
                    state: target.state,
                    phone: target.phone
                }).eq('id', activeUser.id).catch(e => console.log('Profile update notice:', e));
            }
        } catch (error) {
            Alert.alert('Error', 'Could not update default address');
        }
    };

    const handleCopyAddress = async (addr) => {
        const text = `${addr.title || 'Address'}\n${addr.address}\nLGA: ${addr.city || addr.lga || 'N/A'}, ${addr.state}\nPhone: ${addr.phone}`;
        await Clipboard.setStringAsync(text);
        Alert.alert('Copied', 'Address copied to clipboard!');
    };

    const handleShareAddress = async (addr) => {
        try {
            const text = `Shipping Address:\n${addr.address}\n${addr.city ? addr.city + ' LGA, ' : ''}${addr.state}\nReceiver: ${addr.phone}`;
            await Share.share({ message: text });
        } catch (e) {
            console.log('Share error:', e);
        }
    };

    const openModal = (type) => {
        if (type === 'lga' && !formData.state) {
            Alert.alert('Select State First', 'Please choose a State before selecting the Local Government Area.');
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

            {/* ── LUXURY HEADER ── */}
            <View style={localStyles.header}>
                <SafeAreaView>
                    <View style={localStyles.headerRow}>
                        <TouchableOpacity onPress={handleBack} style={localStyles.backBtn} activeOpacity={0.7}>
                            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
                        </TouchableOpacity>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={localStyles.headerTitle}>Shipping Addresses</Text>
                            <Text style={localStyles.headerSub}>Manage your Local Governments & delivery points</Text>
                        </View>
                        {!isAdding && (
                            <TouchableOpacity 
                                onPress={() => {
                                    setEditingId(null);
                                    setFormData({ 
                                        title: 'Home', 
                                        address: '', 
                                        landmark: '',
                                        city: '', 
                                        state: '', 
                                        phone: '', 
                                        latitude: null, 
                                        longitude: null, 
                                        isDefault: addresses.length === 0 
                                    });
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
                    contentContainerStyle={{ padding: 14, paddingBottom: 100 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    showsVerticalScrollIndicator={false}
                >
                    {isAdding ? (
                        /* ── CLEAN ERGONOMIC FORM ── */
                        <View style={localStyles.formCard}>
                            <View style={localStyles.formHeader}>
                                <Text style={localStyles.formTitle}>
                                    {editingId ? 'Edit Shipping Address' : 'New Shipping Address'}
                                </Text>
                                <Text style={localStyles.formSub}>
                                    Accurate Local Government & street ensures reliable delivery fees
                                </Text>
                            </View>

                            {/* ── GPS AUTO-DETECT CARD ── */}
                            <TouchableOpacity
                                onPress={handleUseLocation}
                                disabled={locating}
                                activeOpacity={0.8}
                                style={localStyles.gpsCard}
                            >
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Ionicons name="navigate" size={16} color={GOLD} />
                                        <Text style={localStyles.gpsTitle}>
                                            {locating ? 'Detecting Location...' : 'Detect Current GPS Location'}
                                        </Text>
                                    </View>
                                    <Text style={localStyles.gpsSub}>
                                        Auto-detect coordinates for real-world road transit calculation
                                    </Text>
                                    {formData.latitude && formData.longitude ? (
                                        <View style={localStyles.gpsBadge}>
                                            <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                                            <Text style={localStyles.gpsBadgeText}>
                                                GPS Ready ({formData.latitude.toFixed(3)}, {formData.longitude.toFixed(3)})
                                            </Text>
                                        </View>
                                    ) : null}
                                </View>
                                {locating && <ActivityIndicator size="small" color={GOLD} />}
                            </TouchableOpacity>

                            {/* ── ADDRESS LABEL CHIPS ── */}
                            <View style={localStyles.fieldGroup}>
                                <Text style={localStyles.label}>Address Label</Text>
                                <View style={localStyles.chipsRow}>
                                    {QUICK_TITLES.map((t) => {
                                        const isSelected = formData.title.toLowerCase() === t.toLowerCase();
                                        return (
                                            <TouchableOpacity
                                                key={t}
                                                onPress={() => setFormData({ ...formData, title: t })}
                                                style={[localStyles.chip, isSelected && localStyles.chipSelected]}
                                            >
                                                <Text style={[localStyles.chipText, isSelected && localStyles.chipTextSelected]}>
                                                    {t}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>

                            {/* ── STATE & LOCAL GOVERNMENT AREA (LGA) SELECTORS ── */}
                            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                                {/* State Selector */}
                                <View style={{ flex: 1 }}>
                                    <Text style={localStyles.label}>State *</Text>
                                    <TouchableOpacity 
                                        style={localStyles.pickerBtn} 
                                        onPress={() => openModal('state')}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[localStyles.pickerText, !formData.state && localStyles.placeholderText]} numberOfLines={1}>
                                            {formData.state || 'Select State'}
                                        </Text>
                                        <Ionicons name="chevron-down" size={14} color="#64748B" />
                                    </TouchableOpacity>
                                </View>

                                {/* LGA Selector */}
                                <View style={{ flex: 1 }}>
                                    <Text style={localStyles.label}>Local Gov (LGA) *</Text>
                                    <TouchableOpacity 
                                        style={[localStyles.pickerBtn, !formData.state && { opacity: 0.5 }]} 
                                        onPress={() => openModal('lga')}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[localStyles.pickerText, !formData.city && localStyles.placeholderText]} numberOfLines={1}>
                                            {formData.city || 'Select LGA'}
                                        </Text>
                                        <Ionicons name="chevron-down" size={14} color="#64748B" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* ── STREET ADDRESS ── */}
                            <View style={localStyles.fieldGroup}>
                                <Text style={localStyles.label}>Street Address / Area *</Text>
                                <TextInput
                                    style={localStyles.multilineInput}
                                    multiline
                                    numberOfLines={2}
                                    value={formData.address}
                                    onChangeText={t => setFormData({ ...formData, address: t })}
                                    placeholder="e.g. No. 14 Bompai Road, Commercial District"
                                    placeholderTextColor="#94A3B8"
                                />
                            </View>

                            {/* ── LANDMARK / INSTRUCTIONS (OPTIONAL) ── */}
                            <View style={localStyles.fieldGroup}>
                                <Text style={localStyles.label}>Nearby Landmark / Note (Optional)</Text>
                                <TextInput
                                    style={localStyles.input}
                                    value={formData.landmark}
                                    onChangeText={t => setFormData({ ...formData, landmark: t })}
                                    placeholder="e.g. Opposite Total Filling Station, black gate"
                                    placeholderTextColor="#94A3B8"
                                />
                            </View>

                            {/* ── PHONE NUMBER ── */}
                            <View style={localStyles.fieldGroup}>
                                <Text style={localStyles.label}>Receiver Phone Number *</Text>
                                <TextInput
                                    style={localStyles.input}
                                    value={formData.phone}
                                    onChangeText={t => setFormData({ ...formData, phone: t })}
                                    keyboardType="phone-pad"
                                    placeholder="e.g. 0803 123 4567"
                                    placeholderTextColor="#94A3B8"
                                />
                            </View>

                            {/* ── DEFAULT ADDRESS SWITCH ── */}
                            <View style={localStyles.defaultSwitchRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={localStyles.switchTitle}>Set as Default Delivery Address</Text>
                                    <Text style={localStyles.switchSub}>Pre-selected on checkout for fast orders</Text>
                                </View>
                                <Switch
                                    value={formData.isDefault}
                                    onValueChange={val => setFormData({ ...formData, isDefault: val })}
                                    trackColor={{ false: '#E2E8F0', true: GOLD }}
                                    thumbColor={formData.isDefault ? NAVY : '#FFFFFF'}
                                />
                            </View>

                            {/* ── FORM BUTTONS ── */}
                            <View style={localStyles.formBtnRow}>
                                <TouchableOpacity 
                                    style={localStyles.cancelBtn} 
                                    onPress={() => {
                                        setIsAdding(false);
                                        setEditingId(null);
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <Text style={localStyles.cancelBtnText}>Cancel</Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={localStyles.saveBtn} 
                                    onPress={handleAddAddress}
                                    disabled={submitting}
                                    activeOpacity={0.8}
                                >
                                    {submitting ? (
                                        <ActivityIndicator size="small" color={NAVY} />
                                    ) : (
                                        <Text style={localStyles.saveBtnText}>
                                            {editingId ? 'Update Address' : 'Save Address'}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        /* ── ADDRESS LIST ── */
                        <>
                            {loading ? (
                                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                                    <ActivityIndicator size="large" color={NAVY} />
                                    <Text style={{ marginTop: 12, fontSize: 13, color: '#64748B' }}>Loading addresses...</Text>
                                </View>
                            ) : addresses.length === 0 ? (
                                <View style={localStyles.emptyContainer}>
                                    <View style={localStyles.emptyIconBox}>
                                        <Ionicons name="location-outline" size={36} color="#94A3B8" />
                                    </View>
                                    <Text style={localStyles.emptyTitle}>No Shipping Addresses Yet</Text>
                                    <Text style={localStyles.emptySub}>
                                        Add your home, office, or shop address with Local Government details for seamless distance-based delivery.
                                    </Text>
                                    <TouchableOpacity 
                                        style={localStyles.emptyAddBtn}
                                        onPress={() => setIsAdding(true)}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="add-circle" size={18} color={NAVY} />
                                        <Text style={localStyles.emptyAddBtnText}>Add Shipping Address</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <>
                                    <View style={localStyles.listHeaderRow}>
                                        <Text style={localStyles.listCountText}>
                                            {addresses.length} Saved Address{addresses.length > 1 ? 'es' : ''}
                                        </Text>
                                        <Text style={localStyles.listHintText}>
                                            Used to calculate exact LGA delivery rates
                                        </Text>
                                    </View>

                                    {addresses.map((addr) => {
                                        const lgaName = addr.city || addr.lga;
                                        return (
                                            <View 
                                                key={addr.id} 
                                                style={[
                                                    localStyles.card,
                                                    addr.is_default && localStyles.cardDefault
                                                ]}
                                            >
                                                {/* Default Ribbon */}
                                                {addr.is_default && (
                                                    <View style={localStyles.ribbon}>
                                                        <Ionicons name="star" size={10} color={NAVY} />
                                                        <Text style={localStyles.ribbonText}>DEFAULT</Text>
                                                    </View>
                                                )}

                                                {/* Top Row: Title & LGA Badges */}
                                                <View style={localStyles.cardTopRow}>
                                                    <Text style={localStyles.cardTitle}>{addr.title || 'Address'}</Text>
                                                    {lgaName ? (
                                                        <View style={localStyles.cardLgaBadge}>
                                                            <Ionicons name="location-sharp" size={10} color="#1D4ED8" />
                                                            <Text style={localStyles.cardLgaText}>{lgaName} LGA</Text>
                                                        </View>
                                                    ) : null}
                                                    {addr.latitude && addr.longitude ? (
                                                        <View style={localStyles.cardGpsBadge}>
                                                            <Ionicons name="navigate" size={9} color="#059669" />
                                                            <Text style={localStyles.cardGpsText}>GPS</Text>
                                                        </View>
                                                    ) : null}
                                                </View>

                                                {/* Street & Location */}
                                                <Text style={localStyles.cardStreet} numberOfLines={2}>
                                                    {addr.address}
                                                </Text>
                                                <Text style={localStyles.cardRegion}>
                                                    {lgaName ? `${lgaName}, ` : ''}{addr.state ? `${addr.state} State` : ''}
                                                </Text>
                                                <Text style={localStyles.cardPhone}>
                                                    📞 {addr.phone}
                                                </Text>

                                                {/* Action Bar */}
                                                <View style={localStyles.cardActions}>
                                                    <TouchableOpacity 
                                                        style={localStyles.actionBtn} 
                                                        onPress={() => handleEdit(addr)}
                                                    >
                                                        <Ionicons name="pencil" size={13} color="#2563EB" />
                                                        <Text style={[localStyles.actionText, { color: '#2563EB' }]}>Edit</Text>
                                                    </TouchableOpacity>

                                                    <TouchableOpacity 
                                                        style={localStyles.actionBtn} 
                                                        onPress={() => handleCopyAddress(addr)}
                                                    >
                                                        <Ionicons name="copy-outline" size={13} color="#475569" />
                                                        <Text style={localStyles.actionText}>Copy</Text>
                                                    </TouchableOpacity>

                                                    <TouchableOpacity 
                                                        style={localStyles.actionBtn} 
                                                        onPress={() => handleShareAddress(addr)}
                                                    >
                                                        <Ionicons name="share-social-outline" size={13} color="#475569" />
                                                        <Text style={localStyles.actionText}>Share</Text>
                                                    </TouchableOpacity>

                                                    {!addr.is_default && (
                                                        <TouchableOpacity 
                                                            style={localStyles.actionBtn} 
                                                            onPress={() => handleSetDefault(addr.id)}
                                                        >
                                                            <Ionicons name="star-outline" size={13} color="#059669" />
                                                            <Text style={[localStyles.actionText, { color: '#059669' }]}>Set Default</Text>
                                                        </TouchableOpacity>
                                                    )}

                                                    <TouchableOpacity 
                                                        style={[localStyles.actionBtn, { marginLeft: 'auto' }]} 
                                                        onPress={() => handleDelete(addr.id)}
                                                    >
                                                        <Ionicons name="trash-outline" size={14} color="#EF4444" />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </>
                            )}
                        </>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>

            {/* ── SEARCHABLE BOTTOM SHEET MODAL (FOR STATE & LGA) ── */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={localStyles.modalOverlay}>
                    <View style={localStyles.modalSheet}>
                        <View style={localStyles.modalHeader}>
                            <View>
                                <Text style={localStyles.modalTitle}>
                                    Select {modalType === 'state' ? 'State' : `Local Government (${formData.state})`}
                                </Text>
                                <Text style={localStyles.modalSub}>
                                    {filteredItems.length} available {modalType === 'state' ? 'States' : 'LGAs'}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={localStyles.modalCloseBtn}>
                                <Ionicons name="close" size={18} color={NAVY} />
                            </TouchableOpacity>
                        </View>

                        {/* Search Bar */}
                        <View style={localStyles.searchBox}>
                            <Ionicons name="search" size={16} color="#64748B" />
                            <TextInput
                                style={localStyles.searchInput}
                                placeholder={`Search ${modalType === 'state' ? 'State' : 'LGA'}...`}
                                placeholderTextColor="#94A3B8"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoCorrect={false}
                            />
                            {searchQuery ? (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <Ionicons name="close-circle" size={16} color="#94A3B8" />
                                </TouchableOpacity>
                            ) : null}
                        </View>

                        {/* Items List */}
                        <FlatList
                            data={filteredItems}
                            keyExtractor={(item) => modalType === 'state' ? item.state : item}
                            showsVerticalScrollIndicator={false}
                            renderItem={({ item }) => {
                                const name = modalType === 'state' ? item.state : item;
                                const isSelected = modalType === 'state' 
                                    ? formData.state === name 
                                    : formData.city === name;
                                return (
                                    <TouchableOpacity
                                        style={[localStyles.modalItem, isSelected && localStyles.modalItemSelected]}
                                        onPress={() => handleSelect(item)}
                                    >
                                        <Text style={[localStyles.modalItemText, isSelected && localStyles.modalItemTextSelected]}>
                                            {name}
                                        </Text>
                                        {isSelected && (
                                            <Ionicons name="checkmark-circle" size={18} color={GOLD} />
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
        paddingTop: Platform.OS === 'android' ? 12 : 6,
        paddingBottom: 14
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '900',
        color: '#FFFFFF'
    },
    headerSub: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 1
    },
    headerAddBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: GOLD,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 9
    },
    headerAddBtnText: {
        fontSize: 12.5,
        fontWeight: '900',
        color: NAVY
    },
    formCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2
    },
    formHeader: {
        marginBottom: 14
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
    gpsCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#0E1A2E',
        borderRadius: 12,
        padding: 12,
        marginBottom: 14
    },
    gpsTitle: {
        fontSize: 12.5,
        fontWeight: '800',
        color: GOLD
    },
    gpsSub: {
        fontSize: 10.5,
        color: '#94A3B8',
        marginTop: 2
    },
    gpsBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 6
    },
    gpsBadgeText: {
        fontSize: 10.5,
        fontWeight: '700',
        color: '#10B981'
    },
    fieldGroup: {
        marginBottom: 12
    },
    label: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#475569',
        marginBottom: 5,
        textTransform: 'uppercase',
        letterSpacing: 0.3
    },
    chipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6
    },
    chip: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    chipSelected: {
        backgroundColor: NAVY,
        borderColor: NAVY
    },
    chipText: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#475569'
    },
    chipTextSelected: {
        color: GOLD,
        fontWeight: '800'
    },
    pickerBtn: {
        height: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 10,
        paddingHorizontal: 12
    },
    pickerText: {
        fontSize: 13.5,
        fontWeight: '600',
        color: NAVY,
        flex: 1
    },
    placeholderText: {
        color: '#94A3B8',
        fontWeight: '400'
    },
    input: {
        height: 44,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 10,
        paddingHorizontal: 12,
        fontSize: 13.5,
        color: NAVY
    },
    multilineInput: {
        height: 64,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 13.5,
        color: NAVY,
        textAlignVertical: 'top'
    },
    defaultSwitchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8FAFC',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 16
    },
    switchTitle: {
        fontSize: 12.5,
        fontWeight: '700',
        color: NAVY
    },
    switchSub: {
        fontSize: 10.5,
        color: '#64748B',
        marginTop: 1
    },
    formBtnRow: {
        flexDirection: 'row',
        gap: 10
    },
    cancelBtn: {
        flex: 1,
        height: 44,
        backgroundColor: '#F1F5F9',
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    cancelBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748B'
    },
    saveBtn: {
        flex: 2,
        height: 44,
        backgroundColor: GOLD,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: GOLD,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 2
    },
    saveBtnText: {
        fontSize: 13.5,
        fontWeight: '900',
        color: NAVY
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 50,
        paddingHorizontal: 20
    },
    emptyIconBox: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14
    },
    emptyTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: NAVY,
        marginBottom: 6
    },
    emptySub: {
        fontSize: 12.5,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 18
    },
    emptyAddBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: GOLD,
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 10
    },
    emptyAddBtnText: {
        fontSize: 13,
        fontWeight: '900',
        color: NAVY
    },
    listHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
        paddingHorizontal: 2
    },
    listCountText: {
        fontSize: 12.5,
        fontWeight: '800',
        color: NAVY
    },
    listHintText: {
        fontSize: 10.5,
        color: '#64748B'
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
        position: 'relative',
        overflow: 'hidden'
    },
    cardDefault: {
        borderColor: GOLD
    },
    ribbon: {
        position: 'absolute',
        top: 0,
        right: 0,
        backgroundColor: GOLD,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderBottomLeftRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3
    },
    ribbonText: {
        fontSize: 9,
        fontWeight: '900',
        color: NAVY,
        letterSpacing: 0.5
    },
    cardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
        paddingRight: 60
    },
    cardTitle: {
        fontSize: 14.5,
        fontWeight: '800',
        color: NAVY
    },
    cardLgaBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6
    },
    cardLgaText: {
        fontSize: 10.5,
        fontWeight: '700',
        color: '#1D4ED8'
    },
    cardGpsBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 6
    },
    cardGpsText: {
        fontSize: 9.5,
        fontWeight: '700',
        color: '#059669'
    },
    cardStreet: {
        fontSize: 13,
        color: '#334155',
        lineHeight: 18,
        marginTop: 2
    },
    cardRegion: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
        fontWeight: '500'
    },
    cardPhone: {
        fontSize: 12,
        color: NAVY,
        marginTop: 4,
        fontWeight: '600'
    },
    cardActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 10,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9'
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 2
    },
    actionText: {
        fontSize: 11.5,
        fontWeight: '600',
        color: '#475569'
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(14, 26, 46, 0.65)',
        justifyContent: 'flex-end'
    },
    modalSheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 16,
        maxHeight: '75%',
        minHeight: '55%'
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12
    },
    modalTitle: {
        fontSize: 15.5,
        fontWeight: '900',
        color: NAVY
    },
    modalSub: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 1
    },
    modalCloseBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center'
    },
    searchBox: {
        height: 40,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 10
    },
    searchInput: {
        flex: 1,
        fontSize: 13,
        color: NAVY,
        fontWeight: '600'
    },
    modalItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
        borderRadius: 8
    },
    modalItemSelected: {
        backgroundColor: '#FEF3C7'
    },
    modalItemText: {
        fontSize: 13.5,
        color: '#334155',
        fontWeight: '600'
    },
    modalItemTextSelected: {
        color: NAVY,
        fontWeight: '800'
    }
});

export default AddressPage;
