// mobile/src/screens/admin/AdminShippingManagement.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, ScrollView, TextInput,
    Alert, ActivityIndicator, StyleSheet, Modal, Switch,
    Dimensions, KeyboardAvoidingView, Platform, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import {
    ShippingDistanceService,
    ShippingCalculationEngine,
    ShippingDataService,
    DEFAULT_SHIPPING_SETTINGS,
    DEFAULT_SHIPPING_METHODS,
    NIGERIA_STATE_CENTROIDS
} from '../../services/shippingService';
import { NIGERIA_DATA } from '../../data/nigeriaData';

const { width } = Dimensions.get('window');
const NAVY = '#0E1A2E';
const GOLD = '#D9A73A';

const TABS = [
    { id: 'general',   label: 'General',   icon: 'options-outline' },
    { id: 'methods',   label: 'Methods',   icon: 'paper-plane-outline' },
    { id: 'zones',     label: 'Zones',     icon: 'map-outline' },
    { id: 'vendors',   label: 'Vendors',   icon: 'business-outline' },
    { id: 'simulator', label: 'Simulator', icon: 'calculator-outline' },
    { id: 'analytics', label: 'Analytics', icon: 'analytics-outline' },
];

export const AdminShippingManagement = ({ navigation, onBack }) => {
    const handleBack = () => {
        if (onBack) onBack();
        else if (navigation?.goBack) navigation.goBack();
    };

    const [activeTab, setActiveTab] = useState('general');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // ── DATA STATES ──────────────────────────────────────────────────────────
    const [settings, setSettings] = useState(DEFAULT_SHIPPING_SETTINGS);
    const [initialSettings, setInitialSettings] = useState(DEFAULT_SHIPPING_SETTINGS);
    const [methods, setMethods] = useState(DEFAULT_SHIPPING_METHODS);
    const [zones, setZones] = useState([]);
    const [stores, setStores] = useState({});

    // ── MODAL STATES ─────────────────────────────────────────────────────────
    // Method modal
    const [methodModalVisible, setMethodModalVisible] = useState(false);
    const [editingMethod, setEditingMethod] = useState(null);
    const [methodForm, setMethodForm] = useState({
        id: '',
        name: '',
        description: '',
        base_fee: '1000',
        price_per_km: '75',
        min_fee: '1000',
        max_fee: '25000',
        estimated_delivery_time: '2 - 4 Days',
        is_active: true
    });

    // Zone modal
    const [zoneModalVisible, setZoneModalVisible] = useState(false);
    const [editingZone, setEditingZone] = useState(null);
    const [zoneForm, setZoneForm] = useState({
        name: '',
        state: 'Yobe',
        lga: '',
        base_fee: '',
        price_per_km: '',
        min_fee: '',
        max_fee: '',
        remote_area_fee: '0',
        free_shipping_threshold: '',
        is_active: true
    });

    // Vendor modal
    const [vendorModalVisible, setVendorModalVisible] = useState(false);
    const [editingVendor, setEditingVendor] = useState(null);
    const [detectingGps, setDetectingGps] = useState(false);
    const [vendorForm, setVendorForm] = useState({
        latitude: '',
        longitude: '',
        state: '',
        lga: '',
        custom_shipping_enabled: false,
        custom_base_fee: '',
        custom_price_per_km: '',
        custom_min_fee: '',
        custom_max_fee: '',
        delivery_radius_km: '250'
    });
    const [vendorSearchQuery, setVendorSearchQuery] = useState('');

    // Simulator state
    const [simVendorId, setSimVendorId] = useState('');
    const [simCustomerState, setSimCustomerState] = useState('Yobe');
    const [simCustomerLga, setSimCustomerLga] = useState('Bade');
    const [simCustomerAddress, setSimCustomerAddress] = useState('Gashua Road');
    const [simMethodId, setSimMethodId] = useState('standard');
    const [simOrderAmount, setSimOrderAmount] = useState('15000');
    const [simulating, setSimulating] = useState(false);
    const [simResult, setSimResult] = useState(null);

    // ── INITIAL DATA LOAD ────────────────────────────────────────────────────
    const loadAllData = useCallback(async () => {
        try {
            setLoading(true);
            const [fetchedSettings, fetchedMethods, fetchedZones, fetchedStores] = await Promise.all([
                ShippingDataService.fetchGlobalSettings(),
                ShippingDataService.fetchShippingMethods(),
                ShippingDataService.fetchShippingZones(),
                ShippingDataService.fetchVendorStores()
            ]);

            setSettings(fetchedSettings);
            setInitialSettings(fetchedSettings);
            setMethods(fetchedMethods);
            setZones(fetchedZones);
            setStores(fetchedStores);

            // Default simulator vendor to first store
            const storeIds = Object.keys(fetchedStores);
            if (storeIds.length > 0 && !simVendorId) {
                setSimVendorId(storeIds[0]);
            }
        } catch (error) {
            console.error('Error loading shipping data:', error);
            Alert.alert('Error', 'Failed to load shipping configurations.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [simVendorId]);

    useEffect(() => {
        loadAllData();
    }, [loadAllData]);

    const onRefresh = () => {
        setRefreshing(true);
        loadAllData();
    };

    // ── GENERAL SETTINGS HANDLERS ────────────────────────────────────────────
    const handleSettingChange = (field, value) => {
        setSettings(prev => {
            const updated = { ...prev, [field]: value };
            setHasUnsavedChanges(true);
            return updated;
        });
    };

    const handleSaveGeneralSettings = async () => {
        try {
            setSaving(true);
            const payload = {
                ...settings,
                base_fee: Number(settings.base_fee) || 0,
                price_per_km: Number(settings.price_per_km) || 0,
                min_fee: Number(settings.min_fee) || 0,
                max_fee: Number(settings.max_fee) || 0,
                free_shipping_threshold: Number(settings.free_shipping_threshold) || 0,
                max_delivery_distance_km: Number(settings.max_delivery_distance_km) || 0,
                handling_fee: Number(settings.handling_fee) || 0,
                remote_area_fee: Number(settings.remote_area_fee) || 0,
                vendor_handling_fee: Number(settings.vendor_handling_fee) || 0
            };

            const { error } = await ShippingDataService.saveGlobalSettings(payload);
            if (error) throw error;

            setInitialSettings(payload);
            setHasUnsavedChanges(false);
            Alert.alert('Settings Saved', 'Shipping rules updated successfully and applied across marketplace checkout.');
        } catch (error) {
            Alert.alert('Save Error', error.message || 'Could not save shipping settings');
        } finally {
            setSaving(false);
        }
    };

    const handleResetGeneralSettings = () => {
        Alert.alert(
            'Reset Settings',
            'Revert all unsaved changes back to saved configurations?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Revert',
                    style: 'destructive',
                    onPress: () => {
                        setSettings(initialSettings);
                        setHasUnsavedChanges(false);
                    }
                }
            ]
        );
    };

    // ── SHIPPING METHODS CRUD ────────────────────────────────────────────────
    const openMethodModal = (method = null) => {
        if (method) {
            setEditingMethod(method);
            setMethodForm({
                id: method.id,
                name: method.name || '',
                description: method.description || '',
                base_fee: String(method.base_fee ?? ''),
                price_per_km: String(method.price_per_km ?? ''),
                min_fee: String(method.min_fee ?? ''),
                max_fee: String(method.max_fee ?? ''),
                estimated_delivery_time: method.estimated_delivery_time || '',
                is_active: method.is_active !== false
            });
        } else {
            setEditingMethod(null);
            setMethodForm({
                id: 'custom_' + Date.now().toString().slice(-4),
                name: '',
                description: '',
                base_fee: '1500',
                price_per_km: '80',
                min_fee: '1500',
                max_fee: '30000',
                estimated_delivery_time: '2 - 3 Days',
                is_active: true
            });
        }
        setMethodModalVisible(true);
    };

    const handleSaveMethod = () => {
        if (!methodForm.name.trim()) {
            Alert.alert('Required', 'Please enter a method name.');
            return;
        }

        const newMethod = {
            id: editingMethod ? editingMethod.id : methodForm.id.toLowerCase().replace(/\s+/g, '_'),
            name: methodForm.name.trim(),
            description: methodForm.description.trim(),
            base_fee: Number(methodForm.base_fee) || 0,
            price_per_km: Number(methodForm.price_per_km) || 0,
            min_fee: Number(methodForm.min_fee) || 0,
            max_fee: Number(methodForm.max_fee) || 0,
            estimated_delivery_time: methodForm.estimated_delivery_time.trim() || '2 - 4 Days',
            is_active: methodForm.is_active,
            display_order: editingMethod?.display_order || methods.length + 1
        };

        if (editingMethod) {
            setMethods(prev => prev.map(m => m.id === editingMethod.id ? newMethod : m));
        } else {
            setMethods(prev => [...prev, newMethod]);
        }

        setMethodModalVisible(false);
        Alert.alert('Success', `Method "${newMethod.name}" updated in memory. Remember to save general settings to persist.`);
    };

    const toggleMethodActive = (methodId) => {
        setMethods(prev => prev.map(m => {
            if (m.id === methodId) {
                return { ...m, is_active: !m.is_active };
            }
            return m;
        }));
    };

    // ── SHIPPING ZONES CRUD ──────────────────────────────────────────────────
    const openZoneModal = (zone = null) => {
        if (zone) {
            setEditingZone(zone);
            setZoneForm({
                name: zone.name || '',
                state: zone.state || 'Yobe',
                lga: zone.lga || '',
                base_fee: zone.base_fee !== null && zone.base_fee !== undefined ? String(zone.base_fee) : '',
                price_per_km: zone.price_per_km !== null && zone.price_per_km !== undefined ? String(zone.price_per_km) : '',
                min_fee: zone.min_fee !== null && zone.min_fee !== undefined ? String(zone.min_fee) : '',
                max_fee: zone.max_fee !== null && zone.max_fee !== undefined ? String(zone.max_fee) : '',
                remote_area_fee: String(zone.remote_area_fee || 0),
                free_shipping_threshold: zone.free_shipping_threshold ? String(zone.free_shipping_threshold) : '',
                is_active: zone.is_active !== false
            });
        } else {
            setEditingZone(null);
            setZoneForm({
                name: '',
                state: 'Yobe',
                lga: '',
                base_fee: '',
                price_per_km: '',
                min_fee: '',
                max_fee: '',
                remote_area_fee: '0',
                free_shipping_threshold: '',
                is_active: true
            });
        }
        setZoneModalVisible(true);
    };

    const handleSaveZone = () => {
        if (!zoneForm.name.trim() || !zoneForm.state) {
            Alert.alert('Required', 'Please enter a Zone Name and select a State.');
            return;
        }

        const newZone = {
            id: editingZone ? editingZone.id : 'zone_' + Date.now(),
            name: zoneForm.name.trim(),
            country: 'Nigeria',
            state: zoneForm.state,
            lga: zoneForm.lga.trim() || null,
            base_fee: zoneForm.base_fee ? Number(zoneForm.base_fee) : null,
            price_per_km: zoneForm.price_per_km ? Number(zoneForm.price_per_km) : null,
            min_fee: zoneForm.min_fee ? Number(zoneForm.min_fee) : null,
            max_fee: zoneForm.max_fee ? Number(zoneForm.max_fee) : null,
            remote_area_fee: Number(zoneForm.remote_area_fee) || 0,
            free_shipping_threshold: zoneForm.free_shipping_threshold ? Number(zoneForm.free_shipping_threshold) : null,
            is_active: zoneForm.is_active
        };

        if (editingZone) {
            setZones(prev => prev.map(z => z.id === editingZone.id ? newZone : z));
        } else {
            setZones(prev => [newZone, ...prev]);
        }

        setZoneModalVisible(false);
        Alert.alert('Zone Saved', `Zone rule "${newZone.name}" configured.`);
    };

    const handleDeleteZone = (zoneId) => {
        Alert.alert(
            'Delete Zone Override',
            'Are you sure you want to remove this zone rule?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => setZones(prev => prev.filter(z => z.id !== zoneId))
                }
            ]
        );
    };

    // ── VENDOR LOCATION & GPS ────────────────────────────────────────────────
    const openVendorModal = (vendor) => {
        setEditingVendor(vendor);
        setVendorForm({
            latitude: vendor.latitude ? String(vendor.latitude) : '',
            longitude: vendor.longitude ? String(vendor.longitude) : '',
            state: vendor.state || '',
            lga: vendor.lga || vendor.city || '',
            custom_shipping_enabled: !!vendor.custom_shipping_enabled,
            custom_base_fee: vendor.custom_base_fee !== null && vendor.custom_base_fee !== undefined ? String(vendor.custom_base_fee) : '',
            custom_price_per_km: vendor.custom_price_per_km !== null && vendor.custom_price_per_km !== undefined ? String(vendor.custom_price_per_km) : '',
            custom_min_fee: vendor.custom_min_fee !== null && vendor.custom_min_fee !== undefined ? String(vendor.custom_min_fee) : '',
            custom_max_fee: vendor.custom_max_fee !== null && vendor.custom_max_fee !== undefined ? String(vendor.custom_max_fee) : '',
            delivery_radius_km: String(vendor.delivery_radius_km || 250)
        });
        setVendorModalVisible(true);
    };

    const handleDetectCurrentGps = async () => {
        setDetectingGps(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'GPS location permission is required.');
                return;
            }

            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            if (loc?.coords) {
                setVendorForm(prev => ({
                    ...prev,
                    latitude: String(loc.coords.latitude),
                    longitude: String(loc.coords.longitude)
                }));
                Alert.alert('GPS Captured', `Coordinates set to:\nLat: ${loc.coords.latitude}\nLon: ${loc.coords.longitude}`);
            }
        } catch (error) {
            Alert.alert('GPS Error', error.message || 'Could not obtain device location');
        } finally {
            setDetectingGps(false);
        }
    };

    const handleDetectFromAddress = async () => {
        const fullAddr = `${editingVendor?.address || ''}, ${vendorForm.lga || ''}, ${vendorForm.state || ''}, Nigeria`.trim();
        if (!fullAddr) {
            Alert.alert('Address Missing', 'Please specify vendor state or address.');
            return;
        }

        setDetectingGps(true);
        try {
            const results = await Location.geocodeAsync(fullAddr);
            if (results && results.length > 0) {
                const best = results[0];
                setVendorForm(prev => ({
                    ...prev,
                    latitude: String(best.latitude),
                    longitude: String(best.longitude)
                }));
                Alert.alert('Location Detected', `Resolved from address:\nLat: ${best.latitude}\nLon: ${best.longitude}`);
            } else {
                // Fallback to State centroid
                if (vendorForm.state && NIGERIA_STATE_CENTROIDS[vendorForm.state]) {
                    const centroid = NIGERIA_STATE_CENTROIDS[vendorForm.state];
                    setVendorForm(prev => ({
                        ...prev,
                        latitude: String(centroid.lat),
                        longitude: String(centroid.lon)
                    }));
                    Alert.alert('State Centroid Applied', `Approximated location using ${vendorForm.state} state center.`);
                } else {
                    Alert.alert('Not Found', 'Could not resolve coordinates for this address. Please enter coordinates manually or use GPS.');
                }
            }
        } catch (error) {
            Alert.alert('Geocoding Error', error.message || 'Geocoding service unavailable');
        } finally {
            setDetectingGps(false);
        }
    };

    const handleSaveVendorLocation = () => {
        const lat = Number(vendorForm.latitude);
        const lon = Number(vendorForm.longitude);

        if (vendorForm.latitude && (isNaN(lat) || lat < -90 || lat > 90)) {
            Alert.alert('Invalid Coordinate', 'Latitude must be between -90 and 90.');
            return;
        }
        if (vendorForm.longitude && (isNaN(lon) || lon < -180 || lon > 180)) {
            Alert.alert('Invalid Coordinate', 'Longitude must be between -180 and 180.');
            return;
        }

        const updatedVendor = {
            ...editingVendor,
            latitude: vendorForm.latitude ? lat : null,
            longitude: vendorForm.longitude ? lon : null,
            state: vendorForm.state,
            lga: vendorForm.lga,
            custom_shipping_enabled: vendorForm.custom_shipping_enabled,
            custom_base_fee: vendorForm.custom_base_fee ? Number(vendorForm.custom_base_fee) : null,
            custom_price_per_km: vendorForm.custom_price_per_km ? Number(vendorForm.custom_price_per_km) : null,
            custom_min_fee: vendorForm.custom_min_fee ? Number(vendorForm.custom_min_fee) : null,
            custom_max_fee: vendorForm.custom_max_fee ? Number(vendorForm.custom_max_fee) : null,
            delivery_radius_km: Number(vendorForm.delivery_radius_km) || 250
        };

        setStores(prev => ({
            ...prev,
            [editingVendor.id]: updatedVendor
        }));

        setVendorModalVisible(false);
        Alert.alert('Vendor Updated', `Updated shipping settings and coordinates for "${editingVendor.name}".`);
    };

    // ── SIMULATOR HANDLER ────────────────────────────────────────────────────
    const runSimulator = async () => {
        setSimulating(true);
        try {
            const vendorStore = stores[simVendorId] || {
                id: 'vendor_sample',
                name: 'Kano Distribution Hub',
                state: 'Kano',
                city: 'Kano Municipal',
                latitude: 12.0022,
                longitude: 8.5920
            };

            const customerDest = {
                state: simCustomerState,
                city: simCustomerLga,
                address: simCustomerAddress,
                latitude: NIGERIA_STATE_CENTROIDS[simCustomerState]?.lat,
                longitude: NIGERIA_STATE_CENTROIDS[simCustomerState]?.lon
            };

            const selectedMethod = methods.find(m => m.id === simMethodId) || methods[0];

            // 1. Driving distance
            const distanceRes = await ShippingDistanceService.getDrivingDistance(vendorStore, customerDest);

            // 2. Package calculation
            const calculation = ShippingCalculationEngine.calculateVendorPackageFee({
                vendor: vendorStore,
                customerAddress: customerDest,
                deliveryMethod: selectedMethod,
                packageSubtotal: Number(simOrderAmount) || 0,
                allFreeShipping: false,
                globalSettings: settings,
                zoneOverrides: zones,
                distanceResult: distanceRes
            });

            setSimResult({
                ...calculation,
                vendorStore,
                customerDest,
                orderAmount: Number(simOrderAmount) || 0
            });
        } catch (error) {
            Alert.alert('Simulation Failed', error.message || 'Error executing shipping calculation');
        } finally {
            setSimulating(false);
        }
    };

    // ── FILTERED VENDORS LIST ────────────────────────────────────────────────
    const filteredVendors = useMemo(() => {
        const list = Object.values(stores);
        if (!vendorSearchQuery.trim()) return list;
        const q = vendorSearchQuery.toLowerCase().trim();
        return list.filter(s => 
            s.name?.toLowerCase().includes(q) ||
            s.state?.toLowerCase().includes(q) ||
            s.address?.toLowerCase().includes(q)
        );
    }, [stores, vendorSearchQuery]);

    // ── RENDER TABS CONTENT ──────────────────────────────────────────────────
    const renderGeneralTab = () => (
        <ScrollView style={s.tabContent} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
            {hasUnsavedChanges && (
                <View style={s.unsavedBanner}>
                    <Ionicons name="alert-circle" size={18} color="#D97706" />
                    <Text style={s.unsavedText}>You have unsaved changes to general shipping settings.</Text>
                </View>
            )}

            {/* Master Toggle */}
            <View style={s.card}>
                <View style={s.toggleRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={s.toggleTitle}>Enable Shipping System</Text>
                        <Text style={s.toggleSub}>When disabled, all orders receive free automatic shipping</Text>
                    </View>
                    <Switch
                        value={settings.enabled !== false}
                        onValueChange={v => handleSettingChange('enabled', v)}
                        trackColor={{ false: '#CBD5E1', true: GOLD }}
                        thumbColor={settings.enabled ? NAVY : '#FFFFFF'}
                    />
                </View>
            </View>

            {/* Pricing Parameters Card */}
            <View style={s.card}>
                <Text style={s.sectionHeader}>Distance & Fee Baseline Rules</Text>
                <Text style={s.sectionSub}>Global parameters applied when no local zone or merchant override matches</Text>

                <View style={s.inputGrid}>
                    <View style={s.inputCol}>
                        <Text style={s.inputLabel}>Base Shipping Fee (₦) *</Text>
                        <TextInput
                            style={s.textInput}
                            value={String(settings.base_fee ?? '')}
                            onChangeText={v => handleSettingChange('base_fee', v)}
                            keyboardType="numeric"
                            placeholder="1000"
                        />
                    </View>

                    <View style={s.inputCol}>
                        <Text style={s.inputLabel}>Price Per KM (₦/KM) *</Text>
                        <TextInput
                            style={s.textInput}
                            value={String(settings.price_per_km ?? '')}
                            onChangeText={v => handleSettingChange('price_per_km', v)}
                            keyboardType="numeric"
                            placeholder="75"
                        />
                    </View>
                </View>

                <View style={s.inputGrid}>
                    <View style={s.inputCol}>
                        <Text style={s.inputLabel}>Minimum Fee (₦)</Text>
                        <TextInput
                            style={s.textInput}
                            value={String(settings.min_fee ?? '')}
                            onChangeText={v => handleSettingChange('min_fee', v)}
                            keyboardType="numeric"
                            placeholder="1000"
                        />
                    </View>

                    <View style={s.inputCol}>
                        <Text style={s.inputLabel}>Maximum Fee Cap (₦)</Text>
                        <TextInput
                            style={s.textInput}
                            value={String(settings.max_fee ?? '')}
                            onChangeText={v => handleSettingChange('max_fee', v)}
                            keyboardType="numeric"
                            placeholder="25000"
                        />
                    </View>
                </View>

                <View style={s.inputGrid}>
                    <View style={s.inputCol}>
                        <Text style={s.inputLabel}>Free Shipping Threshold (₦)</Text>
                        <TextInput
                            style={s.textInput}
                            value={String(settings.free_shipping_threshold ?? '')}
                            onChangeText={v => handleSettingChange('free_shipping_threshold', v)}
                            keyboardType="numeric"
                            placeholder="50000"
                        />
                    </View>

                    <View style={s.inputCol}>
                        <Text style={s.inputLabel}>Max Delivery Radius (KM)</Text>
                        <TextInput
                            style={s.textInput}
                            value={String(settings.max_delivery_distance_km ?? '')}
                            onChangeText={v => handleSettingChange('max_delivery_distance_km', v)}
                            keyboardType="numeric"
                            placeholder="350"
                        />
                    </View>
                </View>
            </View>

            {/* Handling & Remote Area Surcharges */}
            <View style={s.card}>
                <Text style={s.sectionHeader}>Logistics & Handling Surcharges</Text>
                <Text style={s.sectionSub}>Additional handling and remote area surcharges</Text>

                <View style={s.inputGrid}>
                    <View style={s.inputCol}>
                        <Text style={s.inputLabel}>Platform Handling Fee (₦)</Text>
                        <TextInput
                            style={s.textInput}
                            value={String(settings.handling_fee ?? '')}
                            onChangeText={v => handleSettingChange('handling_fee', v)}
                            keyboardType="numeric"
                            placeholder="200"
                        />
                    </View>

                    <View style={s.inputCol}>
                        <Text style={s.inputLabel}>Remote Area Fee (₦)</Text>
                        <TextInput
                            style={s.textInput}
                            value={String(settings.remote_area_fee ?? '')}
                            onChangeText={v => handleSettingChange('remote_area_fee', v)}
                            keyboardType="numeric"
                            placeholder="1500"
                        />
                    </View>
                </View>
            </View>

            {/* Delivery Methods System Toggles */}
            <View style={s.card}>
                <Text style={s.sectionHeader}>Enabled Delivery Methods</Text>

                <View style={s.toggleRow}>
                    <Text style={s.toggleTitle}>Standard Delivery</Text>
                    <Switch
                        value={settings.standard_delivery_enabled !== false}
                        onValueChange={v => handleSettingChange('standard_delivery_enabled', v)}
                        trackColor={{ false: '#CBD5E1', true: GOLD }}
                    />
                </View>
                <View style={s.divider} />

                <View style={s.toggleRow}>
                    <Text style={s.toggleTitle}>Express Priority Delivery</Text>
                    <Switch
                        value={settings.express_delivery_enabled !== false}
                        onValueChange={v => handleSettingChange('express_delivery_enabled', v)}
                        trackColor={{ false: '#CBD5E1', true: GOLD }}
                    />
                </View>
                <View style={s.divider} />

                <View style={s.toggleRow}>
                    <Text style={s.toggleTitle}>Same-Day Rush Dispatch</Text>
                    <Switch
                        value={settings.same_day_delivery_enabled !== false}
                        onValueChange={v => handleSettingChange('same_day_delivery_enabled', v)}
                        trackColor={{ false: '#CBD5E1', true: GOLD }}
                    />
                </View>
                <View style={s.divider} />

                <View style={s.toggleRow}>
                    <Text style={s.toggleTitle}>Customer Hub Pickup</Text>
                    <Switch
                        value={settings.customer_pickup_enabled !== false}
                        onValueChange={v => handleSettingChange('customer_pickup_enabled', v)}
                        trackColor={{ false: '#CBD5E1', true: GOLD }}
                    />
                </View>
            </View>

            {/* Action Bar */}
            <View style={s.actionsRow}>
                <TouchableOpacity
                    style={[s.saveBtn, saving && { opacity: 0.7 }]}
                    onPress={handleSaveGeneralSettings}
                    disabled={saving}
                    activeOpacity={0.85}
                >
                    {saving ? (
                        <ActivityIndicator color={NAVY} size="small" />
                    ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons name="checkmark-done" size={18} color={NAVY} />
                            <Text style={s.saveBtnText}>Save Shipping Settings</Text>
                        </View>
                    )}
                </TouchableOpacity>

                {hasUnsavedChanges && (
                    <TouchableOpacity
                        style={s.revertBtn}
                        onPress={handleResetGeneralSettings}
                        activeOpacity={0.8}
                    >
                        <Text style={s.revertBtnText}>Revert</Text>
                    </TouchableOpacity>
                )}
            </View>
        </ScrollView>
    );

    const renderMethodsTab = () => (
        <ScrollView style={s.tabContent} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <View>
                    <Text style={s.sectionHeader}>Delivery Methods ({methods.length})</Text>
                    <Text style={s.sectionSub}>Configure speeds, per-km rates, and delivery estimates</Text>
                </View>
                <TouchableOpacity style={s.addBtn} onPress={() => openMethodModal(null)} activeOpacity={0.8}>
                    <Ionicons name="add" size={16} color="#FFFFFF" />
                    <Text style={s.addBtnText}>New Method</Text>
                </TouchableOpacity>
            </View>

            {methods.map((method) => (
                <View key={method.id} style={s.methodCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Text style={s.methodTitle}>{method.name}</Text>
                                <View style={[s.badge, { backgroundColor: method.is_active ? '#DCFCE7' : '#F1F5F9' }]}>
                                    <Text style={[s.badgeText, { color: method.is_active ? '#166534' : '#64748B' }]}>
                                        {method.is_active ? 'ACTIVE' : 'DISABLED'}
                                    </Text>
                                </View>
                            </View>
                            <Text style={s.methodDesc}>{method.description}</Text>
                        </View>

                        <Switch
                            value={method.is_active}
                            onValueChange={() => toggleMethodActive(method.id)}
                            trackColor={{ false: '#CBD5E1', true: GOLD }}
                        />
                    </View>

                    <View style={s.methodMetaGrid}>
                        <View style={s.methodMetaItem}>
                            <Text style={s.metaLabel}>Base Fee</Text>
                            <Text style={s.metaValue}>₦{Number(method.base_fee || 0).toLocaleString()}</Text>
                        </View>
                        <View style={s.methodMetaItem}>
                            <Text style={s.metaLabel}>Price / KM</Text>
                            <Text style={s.metaValue}>₦{Number(method.price_per_km || 0).toLocaleString()}/km</Text>
                        </View>
                        <View style={s.methodMetaItem}>
                            <Text style={s.metaLabel}>Min Fee</Text>
                            <Text style={s.metaValue}>₦{Number(method.min_fee || 0).toLocaleString()}</Text>
                        </View>
                        <View style={s.methodMetaItem}>
                            <Text style={s.metaLabel}>Est. ETA</Text>
                            <Text style={s.metaValue}>{method.estimated_delivery_time || 'N/A'}</Text>
                        </View>
                    </View>

                    <View style={s.cardFooter}>
                        <TouchableOpacity style={s.editActionBtn} onPress={() => openMethodModal(method)}>
                            <Ionicons name="pencil" size={14} color={NAVY} />
                            <Text style={s.editActionBtnText}>Edit Rates & ETA</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ))}
        </ScrollView>
    );

    const renderZonesTab = () => (
        <ScrollView style={s.tabContent} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <View>
                    <Text style={s.sectionHeader}>Shipping Zones ({zones.length})</Text>
                    <Text style={s.sectionSub}>State & LGA specific rate overrides</Text>
                </View>
                <TouchableOpacity style={s.addBtn} onPress={() => openZoneModal(null)} activeOpacity={0.8}>
                    <Ionicons name="add" size={16} color="#FFFFFF" />
                    <Text style={s.addBtnText}>Add Zone</Text>
                </TouchableOpacity>
            </View>

            {zones.length === 0 ? (
                <View style={s.emptyBox}>
                    <Ionicons name="map-outline" size={42} color="#CBD5E1" />
                    <Text style={s.emptyTitle}>No Custom Zones Configured</Text>
                    <Text style={s.emptySub}>All orders currently follow the global baseline rates. Tap "Add Zone" to create regional overrides.</Text>
                </View>
            ) : (
                zones.map(zone => (
                    <View key={zone.id} style={s.methodCard}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View>
                                <Text style={s.methodTitle}>{zone.name}</Text>
                                <Text style={s.zoneGeo}>
                                    {zone.country || 'Nigeria'} → <Text style={{ fontWeight: '800', color: NAVY }}>{zone.state}</Text>
                                    {zone.lga ? ` → ${zone.lga}` : ' (All LGAs)'}
                                </Text>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TouchableOpacity style={s.iconBtn} onPress={() => openZoneModal(zone)}>
                                    <Ionicons name="pencil" size={16} color={NAVY} />
                                </TouchableOpacity>
                                <TouchableOpacity style={[s.iconBtn, { backgroundColor: '#FEE2E2' }]} onPress={() => handleDeleteZone(zone.id)}>
                                    <Ionicons name="trash" size={16} color="#DC2626" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={s.methodMetaGrid}>
                            <View style={s.methodMetaItem}>
                                <Text style={s.metaLabel}>Base Fee</Text>
                                <Text style={s.metaValue}>{zone.base_fee !== null ? `₦${Number(zone.base_fee).toLocaleString()}` : 'Default'}</Text>
                            </View>
                            <View style={s.methodMetaItem}>
                                <Text style={s.metaLabel}>Price / KM</Text>
                                <Text style={s.metaValue}>{zone.price_per_km !== null ? `₦${zone.price_per_km}/km` : 'Default'}</Text>
                            </View>
                            <View style={s.methodMetaItem}>
                                <Text style={s.metaLabel}>Remote Surcharge</Text>
                                <Text style={s.metaValue}>₦{Number(zone.remote_area_fee || 0).toLocaleString()}</Text>
                            </View>
                        </View>
                    </View>
                ))
            )}
        </ScrollView>
    );

    const renderVendorsTab = () => (
        <ScrollView style={s.tabContent} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
            <View style={{ marginBottom: 14 }}>
                <Text style={s.sectionHeader}>Vendor GPS & Custom Shipping</Text>
                <Text style={s.sectionSub}>Set merchant coordinates for accurate distance-based dispatch calculation</Text>
            </View>

            <View style={s.searchBar}>
                <Ionicons name="search" size={18} color="#94A3B8" />
                <TextInput
                    style={s.searchInput}
                    placeholder="Search vendor by store name or state..."
                    value={vendorSearchQuery}
                    onChangeText={setVendorSearchQuery}
                    placeholderTextColor="#94A3B8"
                />
            </View>

            {filteredVendors.map(vendor => {
                const hasCoordinates = vendor.latitude && vendor.longitude;
                return (
                    <View key={vendor.id} style={s.methodCard}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.methodTitle}>{vendor.name}</Text>
                                <Text style={s.vendorLocationSub}>
                                    {vendor.address ? `${vendor.address}, ` : ''}{vendor.state || 'State not set'}
                                </Text>
                            </View>

                            <View style={[s.badge, { backgroundColor: hasCoordinates ? '#DCFCE7' : '#FEF3C7' }]}>
                                <Text style={[s.badgeText, { color: hasCoordinates ? '#166534' : '#D97706' }]}>
                                    {hasCoordinates ? 'GPS VERIFIED' : 'NO GPS'}
                                </Text>
                            </View>
                        </View>

                        <View style={{ marginTop: 8, flexDirection: 'row', gap: 12 }}>
                            <Text style={s.coordText}>
                                Lat: <Text style={{ fontWeight: '700', color: NAVY }}>{vendor.latitude ? Number(vendor.latitude).toFixed(4) : 'None'}</Text>
                            </Text>
                            <Text style={s.coordText}>
                                Lon: <Text style={{ fontWeight: '700', color: NAVY }}>{vendor.longitude ? Number(vendor.longitude).toFixed(4) : 'None'}</Text>
                            </Text>
                            {vendor.custom_shipping_enabled && (
                                <Text style={{ fontSize: 11, fontWeight: '800', color: GOLD }}>Custom Rates Active</Text>
                            )}
                        </View>

                        <View style={s.cardFooter}>
                            <TouchableOpacity style={s.editActionBtn} onPress={() => openVendorModal(vendor)}>
                                <Ionicons name="location" size={14} color={NAVY} />
                                <Text style={s.editActionBtnText}>Configure Coordinates & Rates</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                );
            })}
        </ScrollView>
    );

    const renderSimulatorTab = () => (
        <ScrollView style={s.tabContent} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
            <View style={{ marginBottom: 14 }}>
                <Text style={s.sectionHeader}>Live Shipping Simulator</Text>
                <Text style={s.sectionSub}>Test route distance, zone prioritization and delivery pricing in real-time</Text>
            </View>

            <View style={s.card}>
                <Text style={s.inputLabel}>Origin Vendor Store</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        {Object.values(stores).slice(0, 8).map(store => (
                            <TouchableOpacity
                                key={store.id}
                                style={[s.chip, simVendorId === store.id && s.chipActive]}
                                onPress={() => setSimVendorId(store.id)}
                            >
                                <Text style={[s.chipText, simVendorId === store.id && s.chipTextActive]}>
                                    {store.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>

                <View style={s.inputGrid}>
                    <View style={s.inputCol}>
                        <Text style={s.inputLabel}>Customer Destination State</Text>
                        <TextInput
                            style={s.textInput}
                            value={simCustomerState}
                            onChangeText={setSimCustomerState}
                            placeholder="e.g. Yobe or Kano"
                        />
                    </View>

                    <View style={s.inputCol}>
                        <Text style={s.inputLabel}>Customer City / LGA</Text>
                        <TextInput
                            style={s.textInput}
                            value={simCustomerLga}
                            onChangeText={setSimCustomerLga}
                            placeholder="e.g. Bade or Ikeja"
                        />
                    </View>
                </View>

                <View style={s.inputGrid}>
                    <View style={s.inputCol}>
                        <Text style={s.inputLabel}>Order Subtotal (₦)</Text>
                        <TextInput
                            style={s.textInput}
                            value={simOrderAmount}
                            onChangeText={setSimOrderAmount}
                            keyboardType="numeric"
                            placeholder="15000"
                        />
                    </View>

                    <View style={s.inputCol}>
                        <Text style={s.inputLabel}>Delivery Method</Text>
                        <TextInput
                            style={s.textInput}
                            value={simMethodId}
                            onChangeText={setSimMethodId}
                            placeholder="standard / express"
                        />
                    </View>
                </View>

                <TouchableOpacity
                    style={[s.saveBtn, { marginTop: 14 }]}
                    onPress={runSimulator}
                    disabled={simulating}
                    activeOpacity={0.85}
                >
                    {simulating ? (
                        <ActivityIndicator color={NAVY} size="small" />
                    ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons name="play" size={16} color={NAVY} />
                            <Text style={s.saveBtnText}>Calculate Distance & Fees</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {/* Simulator Output */}
            {simResult && (
                <View style={[s.card, { borderColor: GOLD, borderWidth: 1.5, backgroundColor: '#FFFDF9' }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={[s.sectionHeader, { color: NAVY }]}>Calculation Result</Text>
                        <View style={[s.badge, { backgroundColor: '#DCFCE7' }]}>
                            <Text style={[s.badgeText, { color: '#166534' }]}>
                                {simResult.distanceSource.toUpperCase()}
                            </Text>
                        </View>
                    </View>

                    <View style={s.simResultRow}>
                        <Text style={s.simLabel}>Origin Store:</Text>
                        <Text style={s.simValue}>{simResult.vendorStore?.name}</Text>
                    </View>

                    <View style={s.simResultRow}>
                        <Text style={s.simLabel}>Destination:</Text>
                        <Text style={s.simValue}>{simResult.customerDest?.city}, {simResult.customerDest?.state}</Text>
                    </View>

                    <View style={s.simResultRow}>
                        <Text style={s.simLabel}>Calculated Distance:</Text>
                        <Text style={[s.simValue, { fontWeight: '900', color: NAVY }]}>{simResult.distanceKm} KM</Text>
                    </View>

                    <View style={s.simResultRow}>
                        <Text style={s.simLabel}>Estimated Road Travel:</Text>
                        <Text style={s.simValue}>{Math.floor(simResult.durationMinutes / 60)}h {simResult.durationMinutes % 60}m</Text>
                    </View>

                    <View style={s.divider} />

                    <View style={s.simResultRow}>
                        <Text style={s.simLabel}>Base Fee:</Text>
                        <Text style={s.simValue}>₦{simResult.baseFee.toLocaleString()}</Text>
                    </View>

                    <View style={s.simResultRow}>
                        <Text style={s.simLabel}>Distance Fee ({simResult.distanceKm}km × ₦{simResult.perKmRate}):</Text>
                        <Text style={s.simValue}>₦{simResult.distanceFee.toLocaleString()}</Text>
                    </View>

                    <View style={s.simResultRow}>
                        <Text style={s.simLabel}>Handling Fee:</Text>
                        <Text style={s.simValue}>₦{simResult.handlingFee.toLocaleString()}</Text>
                    </View>

                    {simResult.remoteAreaFee > 0 && (
                        <View style={s.simResultRow}>
                            <Text style={s.simLabel}>Remote Area Surcharge:</Text>
                            <Text style={s.simValue}>₦{simResult.remoteAreaFee.toLocaleString()}</Text>
                        </View>
                    )}

                    {simResult.isFreeShipping && (
                        <View style={s.simResultRow}>
                            <Text style={[s.simLabel, { color: '#059669', fontWeight: '800' }]}>Free Shipping Discount:</Text>
                            <Text style={[s.simValue, { color: '#059669', fontWeight: '800' }]}>-₦{simResult.discount.toLocaleString()}</Text>
                        </View>
                    )}

                    <View style={[s.divider, { marginVertical: 10 }]} />

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: '900', color: NAVY }}>Final Shipping Fee:</Text>
                        <Text style={{ fontSize: 22, fontWeight: '900', color: GOLD }}>
                            ₦{simResult.finalFee.toLocaleString()}
                        </Text>
                    </View>
                </View>
            )}
        </ScrollView>
    );

    const renderAnalyticsTab = () => {
        const vendorList = Object.values(stores);
        const vendorsWithGps = vendorList.filter(v => v.latitude && v.longitude).length;

        return (
            <ScrollView style={s.tabContent} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                <Text style={s.sectionHeader}>Shipping Health & Analytics</Text>
                <Text style={s.sectionSub}>System overview and readiness metrics</Text>

                <View style={s.statsGrid}>
                    <View style={s.statCard}>
                        <Ionicons name="map" size={24} color={GOLD} />
                        <Text style={s.statNumber}>{zones.length}</Text>
                        <Text style={s.statLabel}>Configured Zones</Text>
                    </View>

                    <View style={s.statCard}>
                        <Ionicons name="paper-plane" size={24} color="#059669" />
                        <Text style={s.statNumber}>{methods.filter(m => m.is_active).length}</Text>
                        <Text style={s.statLabel}>Active Methods</Text>
                    </View>

                    <View style={s.statCard}>
                        <Ionicons name="location" size={24} color="#2563EB" />
                        <Text style={s.statNumber}>{vendorsWithGps} / {vendorList.length}</Text>
                        <Text style={s.statLabel}>Vendors With GPS</Text>
                    </View>

                    <View style={s.statCard}>
                        <Ionicons name="cash" size={24} color={NAVY} />
                        <Text style={s.statNumber}>₦{Number(settings.base_fee || 1000).toLocaleString()}</Text>
                        <Text style={s.statLabel}>Baseline Rate</Text>
                    </View>
                </View>

                <View style={s.card}>
                    <Text style={s.sectionHeader}>Priority Resolution Order</Text>
                    <Text style={{ fontSize: 12.5, color: '#475569', lineHeight: 20, marginTop: 6 }}>
                        When computing customer shipping fees, Abu Mafhal Marketplace strictly applies the following hierarchy:
                    </Text>
                    <View style={{ marginTop: 10, gap: 8 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: NAVY }}>1. Vendor Custom Rules (Merchant delivery radius & rates)</Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: NAVY }}>2. LGA Specific Zone Overrides (e.g. Yobe → Bade / Gashua)</Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: NAVY }}>3. State Specific Zone Overrides (e.g. Kano or Lagos Metro)</Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: NAVY }}>4. Selected Delivery Method Baselines (Express vs Standard)</Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: NAVY }}>5. Global Marketplace Shipping Parameters</Text>
                    </View>
                </View>
            </ScrollView>
        );
    };

    if (loading && !refreshing) {
        return (
            <View style={s.centered}>
                <ActivityIndicator size="large" color={GOLD} />
                <Text style={s.loadingText}>Loading Shipping Configurations...</Text>
            </View>
        );
    }

    return (
        <View style={s.container}>
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={handleBack} style={s.backBtn} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={18} color={NAVY} />
                    <Text style={s.backBtnText}>Admin</Text>
                </TouchableOpacity>

                <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s.headerTitle}>Shipping Management</Text>
                    <Text style={s.headerSub}>Distance fees, zones, methods & GPS routing</Text>
                </View>

                <TouchableOpacity onPress={onRefresh} style={s.refreshBtn} activeOpacity={0.7}>
                    <Ionicons name="refresh" size={18} color={NAVY} />
                </TouchableOpacity>
            </View>

            {/* Horizontal Tabs */}
            <View style={s.tabBar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                    {TABS.map(tab => {
                        const isActive = activeTab === tab.id;
                        return (
                            <TouchableOpacity
                                key={tab.id}
                                style={[s.tabPill, isActive && s.tabPillActive]}
                                onPress={() => setActiveTab(tab.id)}
                                activeOpacity={0.75}
                            >
                                <Ionicons name={tab.icon} size={14} color={isActive ? NAVY : '#FFFFFF'} />
                                <Text style={[s.tabPillText, isActive && s.tabPillTextActive]}>
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Active Content */}
            <View style={{ flex: 1 }}>
                {activeTab === 'general' && renderGeneralTab()}
                {activeTab === 'methods' && renderMethodsTab()}
                {activeTab === 'zones' && renderZonesTab()}
                {activeTab === 'vendors' && renderVendorsTab()}
                {activeTab === 'simulator' && renderSimulatorTab()}
                {activeTab === 'analytics' && renderAnalyticsTab()}
            </View>

            {/* EDIT METHOD MODAL */}
            <Modal visible={methodModalVisible} transparent animationType="slide" onRequestClose={() => setMethodModalVisible(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
                    <View style={s.modalCard}>
                        <View style={s.modalHeader}>
                            <Text style={s.modalTitle}>{editingMethod ? 'Edit Delivery Method' : 'New Delivery Method'}</Text>
                            <TouchableOpacity onPress={() => setMethodModalVisible(false)}>
                                <Ionicons name="close" size={20} color={NAVY} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                            <Text style={s.inputLabel}>Method Name *</Text>
                            <TextInput
                                style={s.textInput}
                                value={methodForm.name}
                                onChangeText={v => setMethodForm(prev => ({ ...prev, name: v }))}
                                placeholder="e.g. Priority Flight Dispatch"
                            />

                            <Text style={s.inputLabel}>Description</Text>
                            <TextInput
                                style={s.textInput}
                                value={methodForm.description}
                                onChangeText={v => setMethodForm(prev => ({ ...prev, description: v }))}
                                placeholder="Brief info shown to customers at checkout"
                            />

                            <View style={s.inputGrid}>
                                <View style={s.inputCol}>
                                    <Text style={s.inputLabel}>Base Fee (₦)</Text>
                                    <TextInput
                                        style={s.textInput}
                                        value={methodForm.base_fee}
                                        onChangeText={v => setMethodForm(prev => ({ ...prev, base_fee: v }))}
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View style={s.inputCol}>
                                    <Text style={s.inputLabel}>Rate Per KM (₦/KM)</Text>
                                    <TextInput
                                        style={s.textInput}
                                        value={methodForm.price_per_km}
                                        onChangeText={v => setMethodForm(prev => ({ ...prev, price_per_km: v }))}
                                        keyboardType="numeric"
                                    />
                                </View>
                            </View>

                            <View style={s.inputGrid}>
                                <View style={s.inputCol}>
                                    <Text style={s.inputLabel}>Minimum Fee (₦)</Text>
                                    <TextInput
                                        style={s.textInput}
                                        value={methodForm.min_fee}
                                        onChangeText={v => setMethodForm(prev => ({ ...prev, min_fee: v }))}
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View style={s.inputCol}>
                                    <Text style={s.inputLabel}>Maximum Fee (₦)</Text>
                                    <TextInput
                                        style={s.textInput}
                                        value={methodForm.max_fee}
                                        onChangeText={v => setMethodForm(prev => ({ ...prev, max_fee: v }))}
                                        keyboardType="numeric"
                                    />
                                </View>
                            </View>

                            <Text style={s.inputLabel}>Estimated Delivery Time (ETA)</Text>
                            <TextInput
                                style={s.textInput}
                                value={methodForm.estimated_delivery_time}
                                onChangeText={v => setMethodForm(prev => ({ ...prev, estimated_delivery_time: v }))}
                                placeholder="e.g. 1 - 2 Business Days"
                            />

                            <View style={s.toggleRow}>
                                <Text style={s.toggleTitle}>Active For Customers</Text>
                                <Switch
                                    value={methodForm.is_active}
                                    onValueChange={v => setMethodForm(prev => ({ ...prev, is_active: v }))}
                                    trackColor={{ false: '#CBD5E1', true: GOLD }}
                                />
                            </View>
                        </ScrollView>

                        <TouchableOpacity style={[s.saveBtn, { marginTop: 14 }]} onPress={handleSaveMethod}>
                            <Text style={s.saveBtnText}>Save Delivery Method</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* EDIT ZONE MODAL */}
            <Modal visible={zoneModalVisible} transparent animationType="slide" onRequestClose={() => setZoneModalVisible(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
                    <View style={s.modalCard}>
                        <View style={s.modalHeader}>
                            <Text style={s.modalTitle}>{editingZone ? 'Edit Shipping Zone' : 'New Shipping Zone'}</Text>
                            <TouchableOpacity onPress={() => setZoneModalVisible(false)}>
                                <Ionicons name="close" size={20} color={NAVY} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                            <Text style={s.inputLabel}>Zone Name *</Text>
                            <TextInput
                                style={s.textInput}
                                value={zoneForm.name}
                                onChangeText={v => setZoneForm(prev => ({ ...prev, name: v }))}
                                placeholder="e.g. Yobe Core Logistics Hub"
                            />

                            <View style={s.inputGrid}>
                                <View style={s.inputCol}>
                                    <Text style={s.inputLabel}>State *</Text>
                                    <TextInput
                                        style={s.textInput}
                                        value={zoneForm.state}
                                        onChangeText={v => setZoneForm(prev => ({ ...prev, state: v }))}
                                        placeholder="e.g. Yobe"
                                    />
                                </View>
                                <View style={s.inputCol}>
                                    <Text style={s.inputLabel}>LGA (Optional)</Text>
                                    <TextInput
                                        style={s.textInput}
                                        value={zoneForm.lga}
                                        onChangeText={v => setZoneForm(prev => ({ ...prev, lga: v }))}
                                        placeholder="Leave empty for whole state"
                                    />
                                </View>
                            </View>

                            <View style={s.inputGrid}>
                                <View style={s.inputCol}>
                                    <Text style={s.inputLabel}>Base Fee (₦)</Text>
                                    <TextInput
                                        style={s.textInput}
                                        value={zoneForm.base_fee}
                                        onChangeText={v => setZoneForm(prev => ({ ...prev, base_fee: v }))}
                                        placeholder="Override"
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View style={s.inputCol}>
                                    <Text style={s.inputLabel}>Rate / KM (₦)</Text>
                                    <TextInput
                                        style={s.textInput}
                                        value={zoneForm.price_per_km}
                                        onChangeText={v => setZoneForm(prev => ({ ...prev, price_per_km: v }))}
                                        placeholder="Override"
                                        keyboardType="numeric"
                                    />
                                </View>
                            </View>

                            <Text style={s.inputLabel}>Remote Area Surcharge (₦)</Text>
                            <TextInput
                                style={s.textInput}
                                value={zoneForm.remote_area_fee}
                                onChangeText={v => setZoneForm(prev => ({ ...prev, remote_area_fee: v }))}
                                placeholder="0"
                                keyboardType="numeric"
                            />
                        </ScrollView>

                        <TouchableOpacity style={[s.saveBtn, { marginTop: 14 }]} onPress={handleSaveZone}>
                            <Text style={s.saveBtnText}>Save Zone Rule</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* EDIT VENDOR LOCATION MODAL */}
            <Modal visible={vendorModalVisible} transparent animationType="slide" onRequestClose={() => setVendorModalVisible(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
                    <View style={s.modalCard}>
                        <View style={s.modalHeader}>
                            <View>
                                <Text style={s.modalTitle}>Vendor GPS & Rates</Text>
                                <Text style={{ fontSize: 11, color: '#64748B' }}>{editingVendor?.name}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setVendorModalVisible(false)}>
                                <Ionicons name="close" size={20} color={NAVY} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
                            {/* GPS detection actions */}
                            <View style={{ flexDirection: 'row', gap: 8, marginVertical: 10 }}>
                                <TouchableOpacity
                                    style={s.gpsActionBtn}
                                    onPress={handleDetectCurrentGps}
                                    disabled={detectingGps}
                                >
                                    <Ionicons name="navigate" size={14} color={NAVY} />
                                    <Text style={s.gpsActionBtnText}>Use My GPS</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={s.gpsActionBtn}
                                    onPress={handleDetectFromAddress}
                                    disabled={detectingGps}
                                >
                                    <Ionicons name="search" size={14} color={NAVY} />
                                    <Text style={s.gpsActionBtnText}>Detect From Addr</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={s.inputGrid}>
                                <View style={s.inputCol}>
                                    <Text style={s.inputLabel}>Latitude (-90 to 90)</Text>
                                    <TextInput
                                        style={s.textInput}
                                        value={vendorForm.latitude}
                                        onChangeText={v => setVendorForm(prev => ({ ...prev, latitude: v }))}
                                        keyboardType="numeric"
                                        placeholder="12.0022"
                                    />
                                </View>
                                <View style={s.inputCol}>
                                    <Text style={s.inputLabel}>Longitude (-180 to 180)</Text>
                                    <TextInput
                                        style={s.textInput}
                                        value={vendorForm.longitude}
                                        onChangeText={v => setVendorForm(prev => ({ ...prev, longitude: v }))}
                                        keyboardType="numeric"
                                        placeholder="8.5920"
                                    />
                                </View>
                            </View>

                            <View style={s.divider} />

                            <View style={s.toggleRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.toggleTitle}>Custom Shipping Rates</Text>
                                    <Text style={s.toggleSub}>Override global rate for this vendor's packages</Text>
                                </View>
                                <Switch
                                    value={vendorForm.custom_shipping_enabled}
                                    onValueChange={v => setVendorForm(prev => ({ ...prev, custom_shipping_enabled: v }))}
                                    trackColor={{ false: '#CBD5E1', true: GOLD }}
                                />
                            </View>

                            {vendorForm.custom_shipping_enabled && (
                                <View style={{ marginTop: 8 }}>
                                    <View style={s.inputGrid}>
                                        <View style={s.inputCol}>
                                            <Text style={s.inputLabel}>Custom Base (₦)</Text>
                                            <TextInput
                                                style={s.textInput}
                                                value={vendorForm.custom_base_fee}
                                                onChangeText={v => setVendorForm(prev => ({ ...prev, custom_base_fee: v }))}
                                                placeholder="e.g. 500"
                                                keyboardType="numeric"
                                            />
                                        </View>
                                        <View style={s.inputCol}>
                                            <Text style={s.inputLabel}>Custom Per KM (₦)</Text>
                                            <TextInput
                                                style={s.textInput}
                                                value={vendorForm.custom_price_per_km}
                                                onChangeText={v => setVendorForm(prev => ({ ...prev, custom_price_per_km: v }))}
                                                placeholder="e.g. 40"
                                                keyboardType="numeric"
                                            />
                                        </View>
                                    </View>
                                </View>
                            )}
                        </ScrollView>

                        <TouchableOpacity style={[s.saveBtn, { marginTop: 14 }]} onPress={handleSaveVendorLocation}>
                            <Text style={s.saveBtnText}>Save Vendor Location & Rates</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
};

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC'
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8FAFC'
    },
    loadingText: {
        marginTop: 12,
        fontSize: 12,
        fontWeight: '800',
        color: NAVY,
        letterSpacing: 0.5
    },
    header: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 14,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderColor: '#E2E8F0'
    },
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10
    },
    backBtnText: {
        fontSize: 12,
        fontWeight: '800',
        color: NAVY
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: NAVY,
        letterSpacing: -0.2
    },
    headerSub: {
        fontSize: 10.5,
        color: '#64748B',
        marginTop: 1
    },
    refreshBtn: {
        padding: 8,
        borderRadius: 10,
        backgroundColor: '#F1F5F9'
    },
    tabBar: {
        backgroundColor: NAVY,
        paddingVertical: 10
    },
    tabPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)'
    },
    tabPillActive: {
        backgroundColor: GOLD,
        borderColor: GOLD
    },
    tabPillText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF'
    },
    tabPillTextActive: {
        color: NAVY,
        fontWeight: '900'
    },
    tabContent: {
        flex: 1,
        padding: 16
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 1
    },
    unsavedBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#FEF3C7',
        padding: 12,
        borderRadius: 12,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#FDE68A'
    },
    unsavedText: {
        flex: 1,
        fontSize: 11.5,
        fontWeight: '700',
        color: '#92400E'
    },
    sectionHeader: {
        fontSize: 14,
        fontWeight: '900',
        color: NAVY
    },
    sectionSub: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 2,
        marginBottom: 12
    },
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4
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
    inputGrid: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 10
    },
    inputCol: {
        flex: 1
    },
    inputLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: '#475569',
        marginBottom: 4,
        textTransform: 'uppercase'
    },
    textInput: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 13,
        color: NAVY,
        fontWeight: '600'
    },
    divider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginVertical: 10
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 6
    },
    saveBtn: {
        flex: 1,
        backgroundColor: GOLD,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center'
    },
    saveBtnText: {
        fontSize: 13,
        fontWeight: '900',
        color: NAVY
    },
    revertBtn: {
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        justifyContent: 'center',
        alignItems: 'center'
    },
    revertBtnText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#64748B'
    },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: NAVY,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10
    },
    addBtnText: {
        fontSize: 11.5,
        fontWeight: '800',
        color: '#FFFFFF'
    },
    methodCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    methodTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: NAVY
    },
    methodDesc: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 3,
        lineHeight: 15
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6
    },
    badgeText: {
        fontSize: 9.5,
        fontWeight: '900'
    },
    methodMetaGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#F8FAFC'
    },
    methodMetaItem: {
        flex: 1,
        minWidth: '22%'
    },
    metaLabel: {
        fontSize: 9.5,
        color: '#94A3B8',
        fontWeight: '700',
        textTransform: 'uppercase'
    },
    metaValue: {
        fontSize: 12,
        fontWeight: '800',
        color: NAVY,
        marginTop: 2
    },
    cardFooter: {
        marginTop: 12,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        flexDirection: 'row',
        justifyContent: 'flex-end'
    },
    editActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 5,
        backgroundColor: '#F8FAFC',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    editActionBtnText: {
        fontSize: 11,
        fontWeight: '800',
        color: NAVY
    },
    iconBtn: {
        padding: 6,
        backgroundColor: '#F1F5F9',
        borderRadius: 8
    },
    zoneGeo: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 3
    },
    emptyBox: {
        padding: 40,
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    emptyTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: NAVY,
        marginTop: 10
    },
    emptySub: {
        fontSize: 11,
        color: '#64748B',
        textAlign: 'center',
        marginTop: 4,
        lineHeight: 16
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 12
    },
    searchInput: {
        flex: 1,
        fontSize: 12.5,
        color: NAVY
    },
    vendorLocationSub: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 2
    },
    coordText: {
        fontSize: 11,
        color: '#64748B'
    },
    gpsActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#F1F5F9',
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#CBD5E1'
    },
    gpsActionBtnText: {
        fontSize: 11,
        fontWeight: '800',
        color: NAVY
    },
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#CBD5E1'
    },
    chipActive: {
        backgroundColor: NAVY,
        borderColor: NAVY
    },
    chipText: {
        fontSize: 11,
        fontWeight: '700',
        color: NAVY
    },
    chipTextActive: {
        color: '#FFFFFF'
    },
    simResultRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginVertical: 3
    },
    simLabel: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '600'
    },
    simValue: {
        fontSize: 12.5,
        fontWeight: '800',
        color: NAVY
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 14
    },
    statCard: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center'
    },
    statNumber: {
        fontSize: 20,
        fontWeight: '900',
        color: NAVY,
        marginTop: 6
    },
    statLabel: {
        fontSize: 10.5,
        color: '#64748B',
        fontWeight: '700',
        marginTop: 2
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(14, 26, 46, 0.65)',
        justifyContent: 'flex-end'
    },
    modalCard: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        maxHeight: '85%'
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        borderBottomWidth: 1,
        borderColor: '#F1F5F9',
        paddingBottom: 10
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: NAVY
    }
});
