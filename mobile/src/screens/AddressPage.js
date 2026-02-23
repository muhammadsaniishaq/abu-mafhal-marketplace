import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, TextInput, Alert, StyleSheet, ActivityIndicator, RefreshControl, KeyboardAvoidingView, Platform, Switch, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles/theme';
import { supabase } from '../lib/supabase';
import { NIGERIA_DATA } from '../data/nigeriaData';
import * as Location from 'expo-location';

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

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [modalType, setModalType] = useState(null); // 'state' or 'lga'

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        address: '',
        city: '', // This will hold the LGA
        state: '',
        phone: '',
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
            title: addr.title,
            address: addr.address,
            city: addr.city, // Saved LGA
            state: addr.state,
            phone: addr.phone,
            isDefault: addr.is_default
        });
        setEditingId(addr.id);
        setIsAdding(true);
    };

    const handleUseLocation = async () => {
        setLocating(true);
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission to access location was denied');
                setLocating(false);
                return;
            }

            // Request Highest Accuracy
            let location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Highest,
                maximumAge: 10000
            });

            let geocode = await Location.reverseGeocodeAsync({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude
            });

            if (geocode && geocode.length > 0) {
                const item = geocode[0];
                console.log("Geocode Result:", item);

                // Better Address Construction
                // We prioritize specific details
                const parts = [];

                if (item.name && item.name !== item.street) parts.push(item.name); // Building/House Name
                if (item.street) parts.push(item.street); // Street Name
                if (item.streetNumber) parts.push(item.streetNumber); // Number
                if (item.district) parts.push(item.district); // District/Area
                if (item.subregion && item.subregion !== item.city) parts.push(item.subregion); // Subregion

                // Filter out generic country names or codes if they snuck in
                const cleanParts = parts.filter(p =>
                    p &&
                    p !== item.isoCountryCode &&
                    p !== item.country
                );

                const fullAddress = cleanParts.length > 0 ? cleanParts.join(', ') : item.city || ''; // Fallback

                // Helper to clean strings
                const cleanString = (str) => (str || '').toLowerCase().trim();

                // Advanced State Matching
                // 1. Try matching region directly
                let matchedState = '';
                let matchedLga = '';
                const regionSearch = cleanString(item.region).replace(' state', '');

                // Find state
                const foundState = NIGERIA_DATA.find(s => cleanString(s.state) === regionSearch || cleanString(s.state) === cleanString(item.region));

                if (foundState) {
                    matchedState = foundState.state;

                    // 2. Try matching LGA from city OR subregion
                    const potentialLgas = [item.city, item.subregion].map(cleanString);
                    const foundLga = foundState.lgas.find(l => potentialLgas.includes(cleanString(l)));

                    if (foundLga) matchedLga = foundLga;
                }

                setFormData(prev => ({
                    ...prev,
                    address: fullAddress || prev.address, // Keep previous if new is empty
                    state: matchedState || prev.state,
                    city: matchedLga || prev.city, // Only overwrite if precise match found
                    title: prev.title || 'Home'
                }));

                // Alert.alert('Location Found', `Updated Address: ${fullAddress}`);
            }
        } catch (error) {
            Alert.alert('Error', 'Could not fetch location: ' + error.message);
        } finally {
            setLocating(false);
        }
    };

    const handleAddAddress = async () => {
        if (!formData.title || !formData.address || !formData.city || !formData.state || !formData.phone) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        try {
            setSubmitting(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                Alert.alert('Error', 'You must be logged in.');
                return;
            }

            const payload = {
                user_id: user.id,
                title: formData.title,
                address: formData.address,
                city: formData.city, // Stores LGA
                state: formData.state,
                phone: formData.phone,
                is_default: formData.isDefault
            };

            let error;
            if (editingId) {
                // Update Logic
                if (payload.is_default) {
                    await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id);
                }
                const { error: updateError } = await supabase
                    .from('addresses')
                    .update(payload)
                    .eq('id', editingId);
                error = updateError;
            } else {
                // Insert Logic
                const isFirst = addresses.length === 0;
                if (isFirst || payload.is_default) {
                    payload.is_default = true;
                    if (!isFirst) {
                        await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id);
                    }
                }
                const { error: insertError } = await supabase.from('addresses').insert([payload]);
                error = insertError;
            }

            if (error) throw error;

            Alert.alert('Success', editingId ? 'Address updated' : 'Address added');
            setIsAdding(false);
            setEditingId(null);
            setFormData({ title: '', address: '', city: '', state: '', phone: '', isDefault: false });
            fetchAddresses();

        } catch (error) {
            Alert.alert('Error', error.message || 'Operation failed');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = (id) => {
        Alert.alert('Delete Address', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
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
        const t = title.toLowerCase();
        if (t.includes('home')) return 'home';
        if (t.includes('office') || t.includes('work')) return 'briefcase';
        if (t.includes('school')) return 'school';
        return 'location';
    };

    // Selection Logic
    const openModal = (type) => {
        if (type === 'lga' && !formData.state) {
            Alert.alert('Select State First', 'Please select a state to see its local governments.');
            return;
        }
        setModalType(type);
        setModalVisible(true);
    };

    const handleSelect = (item) => {
        if (modalType === 'state') {
            setFormData({ ...formData, state: item.state, city: '' }); // Clear LGA when state changes
        } else {
            setFormData({ ...formData, city: item });
        }
        setModalVisible(false);
    };

    const getListItems = () => {
        if (modalType === 'state') return NIGERIA_DATA;
        if (modalType === 'lga') {
            const stateData = NIGERIA_DATA.find(s => s.state === formData.state);
            return stateData ? stateData.lgas : [];
        }
        return [];
    };

    return (
        <View style={[styles.container, { paddingTop: Platform.OS === 'android' ? 40 : 0 }]}>
            <View style={styles.topHeader}>
                <SafeAreaView style={{ backgroundColor: 'transparent' }}>
                    <View style={[styles.headerRow, { justifyContent: 'flex-start', gap: 16 }]}>
                        <TouchableOpacity onPress={handleBack}>
                            <Ionicons name="arrow-back" size={24} color="#0F172A" />
                        </TouchableOpacity>
                        <Text style={styles.sectionTitle}>Shipping Address</Text>
                    </View>
                </SafeAreaView>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView
                    contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                >
                    {isAdding ? (
                        <View>
                            <Text style={[styles.sectionTitle, { marginLeft: 0, marginBottom: 16 }]}>
                                {editingId ? 'Edit Address' : 'Add New Address'}
                            </Text>

                            <TouchableOpacity
                                onPress={handleUseLocation}
                                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', padding: 12, borderRadius: 12, marginBottom: 16, alignSelf: 'flex-start' }}
                            >
                                {locating ? <ActivityIndicator size="small" color="#3B82F6" /> : <Ionicons name="navigate-circle-outline" size={20} color="#3B82F6" />}
                                <Text style={{ color: '#3B82F6', fontWeight: '600', marginLeft: 8 }}>Use Current Location</Text>
                            </TouchableOpacity>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Title (e.g. Home, Office)</Text>
                                <TextInput
                                    style={styles.modernInput || localStyles.input}
                                    value={formData.title}
                                    onChangeText={t => setFormData({ ...formData, title: t })}
                                    placeholder="Home"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Full Address</Text>
                                <TextInput
                                    style={[styles.modernInput || localStyles.input, { height: 80, textAlignVertical: 'top' }]}
                                    multiline
                                    value={formData.address}
                                    onChangeText={t => setFormData({ ...formData, address: t })}
                                    placeholder="Street Address, Area"
                                />
                            </View>

                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <View style={[styles.inputGroup, { flex: 1 }]}>
                                    <Text style={styles.label}>State</Text>
                                    <TouchableOpacity style={styles.modernInput || localStyles.input} onPress={() => openModal('state')}>
                                        <Text style={{ color: formData.state ? '#0F172A' : '#94A3B8' }}>
                                            {formData.state || 'Select State'}
                                        </Text>
                                        <Ionicons name="chevron-down" size={16} color="#94A3B8" style={{ position: 'absolute', right: 12, top: 16 }} />
                                    </TouchableOpacity>
                                </View>
                                <View style={[styles.inputGroup, { flex: 1 }]}>
                                    <Text style={styles.label}>LGA</Text>
                                    <TouchableOpacity style={styles.modernInput || localStyles.input} onPress={() => openModal('lga')}>
                                        <Text style={{ color: formData.city ? '#0F172A' : '#94A3B8' }}>
                                            {formData.city || 'Select LGA'}
                                        </Text>
                                        <Ionicons name="chevron-down" size={16} color="#94A3B8" style={{ position: 'absolute', right: 12, top: 16 }} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Phone Number</Text>
                                <TextInput
                                    style={styles.modernInput || localStyles.input}
                                    value={formData.phone}
                                    onChangeText={t => setFormData({ ...formData, phone: t })}
                                    keyboardType="phone-pad"
                                    placeholder="080..."
                                />
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                                <Text style={styles.label}>Set as Default Address</Text>
                                <Switch
                                    value={formData.isDefault}
                                    onValueChange={v => setFormData({ ...formData, isDefault: v })}
                                    trackColor={{ false: '#E2E8F0', true: '#0F172A' }}
                                />
                            </View>

                            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                                <TouchableOpacity style={[styles.modernBtn, { flex: 1, backgroundColor: '#E2E8F0' }]} onPress={() => setIsAdding(false)}>
                                    <Text style={{ color: '#0F172A', fontWeight: '700' }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modernBtn, { flex: 1, opacity: submitting ? 0.7 : 1 }]}
                                    onPress={handleAddAddress}
                                    disabled={submitting}
                                >
                                    {submitting ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: '700' }}>Save Address</Text>}
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <>
                            {loading ? (
                                <ActivityIndicator size="large" color="#0F172A" style={{ marginTop: 40 }} />
                            ) : addresses.length === 0 ? (
                                <View style={styles.emptyStateContainer}>
                                    <Ionicons name="location-outline" size={48} color="#CBD5E1" />
                                    <Text style={styles.emptyStateText}>No addresses found.</Text>
                                    <TouchableOpacity style={{ marginTop: 10 }} onPress={() => setIsAdding(true)}>
                                        <Text style={{ color: '#4F46E5', fontWeight: '600' }}>Add your first address</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                addresses.map((addr) => (
                                    <View key={addr.id} style={localStyles.addressCard}>
                                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                            <Ionicons name={getIcon(addr.title)} size={20} color="#64748B" />
                                        </View>

                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                                <Text style={localStyles.addressTitle}>{addr.title}</Text>
                                                {addr.is_default && <View style={localStyles.badge}><Text style={localStyles.badgeText}>Default</Text></View>}
                                            </View>
                                            <Text style={localStyles.addressText}>{addr.address}</Text>
                                            <Text style={localStyles.addressText}>{addr.city}, {addr.state}</Text>
                                            <Text style={localStyles.addressPhone}>{addr.phone}</Text>

                                            <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
                                                <TouchableOpacity onPress={() => handleEdit(addr)}>
                                                    <Text style={{ color: '#0F172A', fontSize: 12, fontWeight: '600' }}>Edit</Text>
                                                </TouchableOpacity>
                                                {!addr.is_default && (
                                                    <TouchableOpacity onPress={() => handleSetDefault(addr.id)}>
                                                        <Text style={{ color: '#4F46E5', fontSize: 12, fontWeight: '600' }}>Set Default</Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        </View>
                                        <TouchableOpacity onPress={() => handleDelete(addr.id)} style={{ padding: 8 }}>
                                            <Ionicons name="trash-outline" size={20} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                ))
                            )}
                        </>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>

            {/* SELECTION MODAL */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, height: '70%' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={{ fontSize: 18, fontWeight: '700' }}>
                                Select {modalType === 'state' ? 'State' : 'LGA'}
                            </Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#0F172A" />
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            data={getListItems()}
                            keyExtractor={(item) => modalType === 'state' ? item.state : item}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}
                                    onPress={() => handleSelect(item)}
                                >
                                    <Text style={{ fontSize: 16, color: '#334155' }}>
                                        {modalType === 'state' ? item.state : item}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
            </Modal>

            {!isAdding && !loading && (
                <View style={{ position: 'absolute', bottom: 30, right: 20 }}>
                    <TouchableOpacity
                        style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', boxShadow: '0px 4px 10px rgba(0,0,0,0.1)', }}
                        onPress={() => setIsAdding(true)}
                    >
                        <Ionicons name="add" size={32} color="white" />
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

// Fallback styles if theme doesn't provide them
const localStyles = StyleSheet.create({
    input: {
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
        padding: 16,
        fontSize: 14,
        color: '#0F172A',
        borderWidth: 1,
        borderColor: 'transparent'
    },
    addressCard: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        boxShadow: '0px 4px 10px rgba(0,0,0,0.1)',
    },
    addressTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A'
    },
    addressText: {
        fontSize: 14,
        color: '#64748B',
        marginBottom: 2
    },
    addressPhone: {
        fontSize: 14,
        color: '#0F172A',
        marginTop: 6,
        fontWeight: '500'
    },
    badge: {
        backgroundColor: '#DCFCE7',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4
    },
    badgeText: {
        fontSize: 10,
        color: '#166534',
        fontWeight: '700'
    }
});
