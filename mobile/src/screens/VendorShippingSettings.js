import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Switch,
    Alert,
    ActivityIndicator,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const GOLD = '#D9A73A';
const NAVY = '#0F172A';

export const VendorShippingSettings = ({ user, vendor, onBack, onSaved }) => {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form State mapped to real columns in stores table
    const [customShippingEnabled, setCustomShippingEnabled] = useState(false);
    const [customBaseFee, setCustomBaseFee] = useState('1000');
    const [customPricePerKm, setCustomPricePerKm] = useState('100');
    const [customMinFee, setCustomMinFee] = useState('800');
    const [customMaxFee, setCustomMaxFee] = useState('5000');
    const [deliveryRadiusKm, setDeliveryRadiusKm] = useState('35');
    const [supportsPickup, setSupportsPickup] = useState(true);
    const [supportsExpress, setSupportsExpress] = useState(false);
    const [dispatchNotes, setDispatchNotes] = useState('');

    useEffect(() => {
        loadShippingData();
    }, [user?.id]);

    const loadShippingData = async () => {
        try {
            setLoading(true);
            const targetId = user?.id;
            if (!targetId) return;

            const { data, error } = await supabase
                .from('stores')
                .select('*')
                .eq('user_id', targetId)
                .maybeSingle();

            if (data) {
                setCustomShippingEnabled(!!data.custom_shipping_enabled);
                setCustomBaseFee(data.custom_base_fee?.toString() || '1000');
                setCustomPricePerKm(data.custom_price_per_km?.toString() || '100');
                setCustomMinFee(data.custom_min_fee?.toString() || '800');
                setCustomMaxFee(data.custom_max_fee?.toString() || '5000');
                setDeliveryRadiusKm(data.delivery_radius_km?.toString() || '35');
                setSupportsPickup(data.supports_pickup !== false);
                setSupportsExpress(!!data.supports_express);
                setDispatchNotes(data.policy || '');
            }
        } catch (err) {
            console.error('Error loading vendor shipping settings:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        const base = parseFloat(customBaseFee) || 0;
        const perKm = parseFloat(customPricePerKm) || 0;
        const minFee = parseFloat(customMinFee) || 0;
        const maxFee = parseFloat(customMaxFee) || 0;
        const radius = parseFloat(deliveryRadiusKm) || 35;

        if (customShippingEnabled && (base < 0 || perKm < 0)) {
            return Alert.alert('Invalid Rates', 'Please enter valid non-negative fees.');
        }

        try {
            setSaving(true);
            const targetId = user?.id;

            const payload = {
                custom_shipping_enabled: customShippingEnabled,
                custom_base_fee: base,
                custom_price_per_km: perKm,
                custom_min_fee: minFee,
                custom_max_fee: maxFee,
                delivery_radius_km: radius,
                supports_pickup: supportsPickup,
                supports_express: supportsExpress,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('stores')
                .update(payload)
                .eq('user_id', targetId);

            if (error) throw error;

            if (Platform.OS === 'web') {
                alert('Store shipping rates updated successfully!');
            } else {
                Alert.alert('Success', 'Store shipping & delivery rates saved.');
            }

            if (onSaved) onSaved();
            if (onBack) onBack();
        } catch (err) {
            console.error('Save shipping settings error:', err);
            Alert.alert('Error', err.message || 'Failed to save shipping settings.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={GOLD} />
                <Text style={styles.loadingTxt}>Loading store shipping configuration...</Text>
            </View>
        );
    }

    return (
        <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.container}
        >
            {/* Header info */}
            <View style={styles.headerBox}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Delivery & Shipping Rates</Text>
                    <Text style={styles.sub}>
                        Configure whether orders use Abu Mafhal standard delivery or your store custom dispatch rates.
                    </Text>
                </View>
            </View>

            {/* Toggle Switch Card */}
            <View style={[styles.card, styles.toggleCard]}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="car-sport" size={20} color={customShippingEnabled ? '#10B981' : '#64748B'} />
                        <Text style={styles.toggleCardTitle}>Custom Store Delivery</Text>
                    </View>
                    <Text style={styles.toggleCardSub}>
                        {customShippingEnabled
                            ? 'Enabled: Your custom base fee and per-km rates are applied at checkout.'
                            : 'Disabled: Abu Mafhal marketplace standard shipping matrix applies.'}
                    </Text>
                </View>
                <Switch
                    value={customShippingEnabled}
                    onValueChange={setCustomShippingEnabled}
                    trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                    thumbColor="#FFFFFF"
                />
            </View>

            {/* Rate Inputs (if custom enabled) */}
            {customShippingEnabled && (
                <View style={styles.card}>
                    <Text style={styles.cardSectionTitle}>Pricing & Rate Formula</Text>
                    <Text style={styles.cardSectionSub}>
                        Formula: Total Shipping = Base Fee + (Distance KM × Rate Per KM)
                    </Text>

                    {/* Base Delivery Fee */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Base Delivery Fee (₦)</Text>
                        <TextInput
                            style={styles.textInput}
                            keyboardType="numeric"
                            value={customBaseFee}
                            onChangeText={setCustomBaseFee}
                            placeholder="e.g. 1000"
                            placeholderTextColor="#94A3B8"
                        />
                        <Text style={styles.inputHint}>Starting fee before distance calculation.</Text>
                    </View>

                    {/* Price Per KM */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Rate Per Kilometer (₦/KM)</Text>
                        <TextInput
                            style={styles.textInput}
                            keyboardType="numeric"
                            value={customPricePerKm}
                            onChangeText={setCustomPricePerKm}
                            placeholder="e.g. 100"
                            placeholderTextColor="#94A3B8"
                        />
                        <Text style={styles.inputHint}>Charged per kilometer from your store coordinates.</Text>
                    </View>

                    {/* Min & Max Fee Row */}
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={styles.inputLabel}>Min Fee (₦)</Text>
                            <TextInput
                                style={styles.textInput}
                                keyboardType="numeric"
                                value={customMinFee}
                                onChangeText={setCustomMinFee}
                                placeholder="800"
                                placeholderTextColor="#94A3B8"
                            />
                        </View>
                        <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={styles.inputLabel}>Max Cap Fee (₦)</Text>
                            <TextInput
                                style={styles.textInput}
                                keyboardType="numeric"
                                value={customMaxFee}
                                onChangeText={setCustomMaxFee}
                                placeholder="5000"
                                placeholderTextColor="#94A3B8"
                            />
                        </View>
                    </View>

                    {/* Delivery Radius */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Max Delivery Radius (KM)</Text>
                        <TextInput
                            style={styles.textInput}
                            keyboardType="numeric"
                            value={deliveryRadiusKm}
                            onChangeText={setDeliveryRadiusKm}
                            placeholder="e.g. 35"
                            placeholderTextColor="#94A3B8"
                        />
                        <Text style={styles.inputHint}>Maximum distance your store dispatch can reach.</Text>
                    </View>
                </View>
            )}

            {/* Delivery Methods & Options Card */}
            <View style={styles.card}>
                <Text style={styles.cardSectionTitle}>Customer Fulfillment Options</Text>

                {/* In-Store Pickup */}
                <View style={styles.optionRow}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="storefront-outline" size={17} color="#0F172A" />
                            <Text style={styles.optionTitle}>In-Store Customer Pickup</Text>
                        </View>
                        <Text style={styles.optionDesc}>
                            Allow buyers to pick up items directly at your physical store address for free.
                        </Text>
                    </View>
                    <Switch
                        value={supportsPickup}
                        onValueChange={setSupportsPickup}
                        trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                        thumbColor="#FFFFFF"
                    />
                </View>

                <View style={styles.divider} />

                {/* Same-Day Rush Delivery */}
                <View style={styles.optionRow}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="flash-outline" size={17} color="#F59E0B" />
                            <Text style={styles.optionTitle}>Express / Same-Day Dispatch</Text>
                        </View>
                        <Text style={styles.optionDesc}>
                            Show badge that your store supports urgent local rush dispatch.
                        </Text>
                    </View>
                    <Switch
                        value={supportsExpress}
                        onValueChange={setSupportsExpress}
                        trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                        thumbColor="#FFFFFF"
                    />
                </View>
            </View>

            {/* Save Button */}
            <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
            >
                {saving ? (
                    <ActivityIndicator size="small" color="#0F172A" />
                ) : (
                    <>
                        <Ionicons name="checkmark-done" size={18} color="#0F172A" />
                        <Text style={styles.saveBtnText}>Save Delivery Settings</Text>
                    </>
                )}
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
        paddingBottom: 110
    },
    loadingBox: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 30
    },
    loadingTxt: {
        marginTop: 12,
        fontSize: 13,
        color: '#64748B',
        fontWeight: '600'
    },
    headerBox: {
        marginBottom: 16
    },
    title: {
        fontSize: 18,
        fontWeight: '900',
        color: '#0F172A',
        letterSpacing: -0.3
    },
    sub: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 3,
        lineHeight: 17
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOpacity: 0.02,
        shadowRadius: 6,
        elevation: 1
    },
    toggleCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 18
    },
    toggleCardTitle: {
        fontSize: 14.5,
        fontWeight: '800',
        color: '#0F172A'
    },
    toggleCardSub: {
        fontSize: 11.5,
        color: '#64748B',
        marginTop: 3,
        lineHeight: 16
    },
    cardSectionTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0F172A'
    },
    cardSectionSub: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 2,
        marginBottom: 14
    },
    inputGroup: {
        marginBottom: 12
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 6
    },
    textInput: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A'
    },
    inputHint: {
        fontSize: 10.5,
        color: '#94A3B8',
        marginTop: 4
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8
    },
    optionTitle: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#0F172A'
    },
    optionDesc: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 2,
        lineHeight: 15
    },
    divider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginVertical: 10
    },
    saveBtn: {
        backgroundColor: GOLD,
        borderRadius: 14,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 6
    },
    saveBtnText: {
        fontSize: 14,
        fontWeight: '900',
        color: '#0F172A'
    }
});
