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
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';

const GOLD = '#D9A73A';
const GOLD_SURFACE = '#FEF9C3';
const GOLD_DARK = '#B45309';
const NAVY_DARK = '#0A192F';
const CARD_BG = '#FFFFFF';
const CANVAS_BG = '#F8FAFC';
const BORDER_COLOR = '#E2E8F0';
const TEXT_PRIMARY = '#0F172A';
const TEXT_SECONDARY = '#475569';
const TEXT_MUTED = '#94A3B8';
const EMERALD = '#10B981';
const EMERALD_SURFACE = '#ECFDF5';

// Nigerian Logistics Dispatch Channels
const DISPATCH_CHANNELS = [
    {
        id: 'local_rider',
        name: 'Local Bike Dispatch Riders',
        desc: 'Doorstep parcel delivery within city / state',
        icon: 'bicycle',
        badge: 'Intra-State ⚡'
    },
    {
        id: 'motor_park',
        name: 'Motor Park Cargo / Bus Waybill',
        desc: 'Interstate cargo via Kantin Kwari, Alaba or Central bus parks',
        icon: 'bus',
        badge: 'Interstate 🚌'
    },
    {
        id: 'gig_courier',
        name: 'GIG Logistics / Fez / Speedaf',
        desc: 'Tracked commercial corporate courier services',
        icon: 'cube',
        badge: 'Nationwide 📦'
    },
    {
        id: 'express_air',
        name: 'DHL / FedEx Express',
        desc: 'Priority air courier for high-value merchandise',
        icon: 'airplane',
        badge: 'Priority ✈️'
    }
];

export const VendorShippingSettings = ({ user, vendor, onBack, onSaved }) => {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form State mapped to real columns in stores table
    const [customShippingEnabled, setCustomShippingEnabled] = useState(false);
    const [customBaseFee, setCustomBaseFee] = useState('1500');
    const [customPricePerKm, setCustomPricePerKm] = useState('150');
    const [customMinFee, setCustomMinFee] = useState('1000');
    const [customMaxFee, setCustomMaxFee] = useState('8000');
    const [deliveryRadiusKm, setDeliveryRadiusKm] = useState('40');
    const [supportsPickup, setSupportsPickup] = useState(true);
    const [supportsExpress, setSupportsExpress] = useState(true);
    const [pickupAddress, setPickupAddress] = useState(vendor?.address || '');
    const [workingHours, setWorkingHours] = useState('Mon - Sat: 9:00 AM - 6:00 PM');
    const [freeShippingEnabled, setFreeShippingEnabled] = useState(false);
    const [freeShippingThreshold, setFreeShippingThreshold] = useState('50000');
    const [selectedChannels, setSelectedChannels] = useState(['local_rider', 'motor_park']);
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
                setCustomBaseFee(data.custom_base_fee?.toString() || '1500');
                setCustomPricePerKm(data.custom_price_per_km?.toString() || '150');
                setCustomMinFee(data.custom_min_fee?.toString() || '1000');
                setCustomMaxFee(data.custom_max_fee?.toString() || '8000');
                setDeliveryRadiusKm(data.delivery_radius_km?.toString() || '40');
                setSupportsPickup(data.supports_pickup !== false);
                setSupportsExpress(!!data.supports_express);
                setPickupAddress(data.address || vendor?.address || '');
                setWorkingHours(data.working_hours || 'Mon - Sat: 9:00 AM - 6:00 PM');

                // Parse policy notes if formatted
                if (data.policy) {
                    setDispatchNotes(data.policy);
                    if (data.policy.includes('Free delivery on orders above ₦')) {
                        setFreeShippingEnabled(true);
                        const match = data.policy.match(/₦([0-9,]+)/);
                        if (match && match[1]) {
                            setFreeShippingThreshold(match[1].replace(/,/g, ''));
                        }
                    }
                }
            } else if (vendor) {
                setPickupAddress(vendor.address || '');
            }
        } catch (err) {
            console.error('Error loading vendor shipping settings:', err);
        } finally {
            setLoading(false);
        }
    };

    const toggleChannel = (channelId) => {
        if (selectedChannels.includes(channelId)) {
            if (selectedChannels.length === 1) {
                Alert.alert('Notice', 'At least one logistics channel must remain selected.');
                return;
            }
            setSelectedChannels(selectedChannels.filter(c => c !== channelId));
        } else {
            setSelectedChannels([...selectedChannels, channelId]);
        }
    };

    const handleSave = async () => {
        const base = parseFloat(customBaseFee) || 0;
        const perKm = parseFloat(customPricePerKm) || 0;
        const minFee = parseFloat(customMinFee) || 0;
        const maxFee = parseFloat(customMaxFee) || 0;
        const radius = parseFloat(deliveryRadiusKm) || 40;

        if (customShippingEnabled && (base < 0 || perKm < 0)) {
            return Alert.alert('Invalid Rates', 'Please enter valid non-negative fees.');
        }

        try {
            setSaving(true);
            const targetId = user?.id;
            if (!targetId) throw new Error('Vendor session not found. Please log in.');

            let compiledPolicy = dispatchNotes.trim();
            if (freeShippingEnabled && freeShippingThreshold) {
                const thresholdNum = parseFloat(freeShippingThreshold) || 0;
                compiledPolicy += ` | Free delivery on orders above ₦${thresholdNum.toLocaleString()}`;
            }

            const payload = {
                custom_shipping_enabled: customShippingEnabled,
                custom_base_fee: base,
                custom_price_per_km: perKm,
                custom_min_fee: minFee,
                custom_max_fee: maxFee,
                delivery_radius_km: radius,
                supports_pickup: supportsPickup,
                supports_express: supportsExpress,
                address: pickupAddress,
                working_hours: workingHours,
                policy: compiledPolicy,
                updated_at: new Date().toISOString()
            };

            // Check if store already exists for user
            const { data: existingStore } = await supabase
                .from('stores')
                .select('id')
                .eq('user_id', targetId)
                .maybeSingle();

            if (existingStore?.id) {
                const { error } = await supabase
                    .from('stores')
                    .update(payload)
                    .eq('id', existingStore.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('stores')
                    .insert([{
                        user_id: targetId,
                        name: vendor?.business_name || vendor?.name || user?.user_metadata?.full_name || 'My Store',
                        about: vendor?.about || '',
                        category: vendor?.business_category || vendor?.category || 'Electronics',
                        phone: vendor?.phone || user?.user_metadata?.phone_number || '',
                        address: pickupAddress || vendor?.address || '',
                        state: vendor?.state || 'Kano',
                        ...payload
                    }]);
                if (error) throw error;
            }

            if (Platform.OS === 'web') {
                alert('Store logistics & delivery rates saved successfully!');
            } else {
                Alert.alert('Settings Saved', 'Your store delivery rates and logistics preferences are now 100% active.');
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
                <Text style={styles.loadingTxt}>Loading store logistics configuration...</Text>
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
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.title}>Logistics & Dispatch Hub</Text>
                        <Text style={styles.sub}>
                            Manage store delivery fees, interstate waybill, and customer walk-in pickup.
                        </Text>
                    </View>
                    {onBack && (
                        <TouchableOpacity onPress={onBack} style={styles.backBtnHeader}>
                            <Ionicons name="close" size={20} color={NAVY_DARK} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Logistics Status Banner */}
            <LinearGradient
                colors={['#0A192F', '#1E3A5F']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.bannerCard}
            >
                <View style={styles.bannerIconBox}>
                    <Ionicons name="cube" size={24} color={GOLD} />
                </View>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.bannerTitle}>Active Fulfillment Status</Text>
                        <View style={styles.liveTag}>
                            <View style={styles.liveDot} />
                            <Text style={styles.liveTagText}>100% OPERATIONAL</Text>
                        </View>
                    </View>
                    <Text style={styles.bannerSub}>
                        {customShippingEnabled
                            ? 'Custom Store Rates: Orders calculate fees from your store distance matrix.'
                            : 'Standard Fulfillment: Abu Mafhal marketplace default shipping rates apply.'}
                    </Text>
                </View>
            </LinearGradient>

            {/* Toggle Switch Card */}
            <View style={[styles.card, styles.toggleCard]}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={[styles.switchIconBox, { backgroundColor: customShippingEnabled ? EMERALD_SURFACE : '#F1F5F9' }]}>
                            <Ionicons
                                name="car-sport"
                                size={20}
                                color={customShippingEnabled ? EMERALD : TEXT_MUTED}
                            />
                        </View>
                        <View>
                            <Text style={styles.toggleCardTitle}>Custom Store Delivery</Text>
                            <Text style={styles.toggleCardSub}>
                                {customShippingEnabled
                                    ? 'Enabled: Your custom base fee and per-km rates are applied at checkout.'
                                    : 'Disabled: Marketplace standard delivery matrix applies.'}
                            </Text>
                        </View>
                    </View>
                </View>
                <Switch
                    value={customShippingEnabled}
                    onValueChange={setCustomShippingEnabled}
                    trackColor={{ false: '#CBD5E1', true: EMERALD }}
                    thumbColor="#FFFFFF"
                />
            </View>

            {/* Rate Inputs (if custom enabled) */}
            {customShippingEnabled && (
                <View style={styles.card}>
                    <View style={styles.cardHeaderRow}>
                        <Ionicons name="calculator-outline" size={18} color={GOLD_DARK} />
                        <Text style={styles.cardSectionTitle}>Pricing & Rate Formula</Text>
                    </View>
                    <Text style={styles.cardSectionSub}>
                        Formula: Total Shipping = Base Fee + (Distance KM × Rate Per KM)
                    </Text>

                    {/* Base Delivery Fee */}
                    <View style={styles.inputGroup}>
                        <View style={styles.labelRow}>
                            <Text style={styles.inputLabel}>Base Starting Delivery Fee (₦)</Text>
                            <Text style={styles.reqStar}>*</Text>
                        </View>
                        <TextInput
                            style={styles.textInput}
                            keyboardType="numeric"
                            value={customBaseFee}
                            onChangeText={setCustomBaseFee}
                            placeholder="e.g. 1500"
                            placeholderTextColor={TEXT_MUTED}
                        />
                        <Text style={styles.inputHint}>Starting fee before distance calculation.</Text>
                    </View>

                    {/* Price Per KM */}
                    <View style={styles.inputGroup}>
                        <View style={styles.labelRow}>
                            <Text style={styles.inputLabel}>Rate Per Kilometer (₦/KM)</Text>
                            <Text style={styles.reqStar}>*</Text>
                        </View>
                        <TextInput
                            style={styles.textInput}
                            keyboardType="numeric"
                            value={customPricePerKm}
                            onChangeText={setCustomPricePerKm}
                            placeholder="e.g. 150"
                            placeholderTextColor={TEXT_MUTED}
                        />
                        <Text style={styles.inputHint}>Charged per kilometer from your store coordinates.</Text>
                    </View>

                    {/* Min & Max Fee Row */}
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={styles.inputLabel}>Min Cap (₦)</Text>
                            <TextInput
                                style={styles.textInput}
                                keyboardType="numeric"
                                value={customMinFee}
                                onChangeText={setCustomMinFee}
                                placeholder="1000"
                                placeholderTextColor={TEXT_MUTED}
                            />
                        </View>
                        <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={styles.inputLabel}>Max Cap Fee (₦)</Text>
                            <TextInput
                                style={styles.textInput}
                                keyboardType="numeric"
                                value={customMaxFee}
                                onChangeText={setCustomMaxFee}
                                placeholder="8000"
                                placeholderTextColor={TEXT_MUTED}
                            />
                        </View>
                    </View>

                    {/* Delivery Radius */}
                    <View style={styles.inputGroup}>
                        <View style={styles.labelRow}>
                            <Text style={styles.inputLabel}>Maximum Dispatch Radius (KM)</Text>
                            <Text style={styles.reqStar}>*</Text>
                        </View>
                        <TextInput
                            style={styles.textInput}
                            keyboardType="numeric"
                            value={deliveryRadiusKm}
                            onChangeText={setDeliveryRadiusKm}
                            placeholder="e.g. 40"
                            placeholderTextColor={TEXT_MUTED}
                        />
                        <Text style={styles.inputHint}>Parcels further than this distance will prompt interstate waybill dispatch.</Text>
                    </View>
                </View>
            )}

            {/* Supported Dispatch Partners / Waybill Channels */}
            <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                    <Ionicons name="trail-sign-outline" size={18} color={NAVY_DARK} />
                    <Text style={styles.cardSectionTitle}>Supported Logistics Channels</Text>
                </View>
                <Text style={styles.cardSectionSub}>
                    Select the courier methods your store uses to dispatch orders:
                </Text>

                <View style={{ gap: 10 }}>
                    {DISPATCH_CHANNELS.map(ch => {
                        const isSelected = selectedChannels.includes(ch.id);
                        return (
                            <TouchableOpacity
                                key={ch.id}
                                style={[
                                    styles.channelCard,
                                    isSelected && styles.channelCardSelected
                                ]}
                                onPress={() => toggleChannel(ch.id)}
                                activeOpacity={0.8}
                            >
                                <View style={[styles.channelIconBox, isSelected && { backgroundColor: NAVY_DARK }]}>
                                    <Ionicons
                                        name={ch.icon}
                                        size={20}
                                        color={isSelected ? GOLD : TEXT_MUTED}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={[styles.channelTitle, isSelected && { color: NAVY_DARK, fontWeight: '900' }]}>
                                            {ch.name}
                                        </Text>
                                        <View style={[styles.channelBadge, isSelected && { backgroundColor: GOLD_SURFACE }]}>
                                            <Text style={[styles.channelBadgeText, isSelected && { color: GOLD_DARK }]}>
                                                {ch.badge}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={styles.channelDesc}>{ch.desc}</Text>
                                </View>
                                <View style={[styles.checkboxCircle, isSelected && styles.checkboxCircleActive]}>
                                    {isSelected && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* Delivery Methods & Options Card */}
            <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                    <Ionicons name="options-outline" size={18} color={NAVY_DARK} />
                    <Text style={styles.cardSectionTitle}>Customer Fulfillment Features</Text>
                </View>

                {/* In-Store Pickup */}
                <View style={styles.optionRow}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="storefront-outline" size={17} color={NAVY_DARK} />
                            <Text style={styles.optionTitle}>Walk-in Customer Pickup Station</Text>
                        </View>
                        <Text style={styles.optionDesc}>
                            Allow buyers to pick up items at your physical shop address for free.
                        </Text>
                    </View>
                    <Switch
                        value={supportsPickup}
                        onValueChange={setSupportsPickup}
                        trackColor={{ false: '#CBD5E1', true: EMERALD }}
                        thumbColor="#FFFFFF"
                    />
                </View>

                {supportsPickup && (
                    <View style={styles.pickupDetailsBox}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Pickup Station Address</Text>
                            <TextInput
                                style={styles.textInput}
                                value={pickupAddress}
                                onChangeText={setPickupAddress}
                                placeholder="Shop / Suite number, Street, Plaza"
                                placeholderTextColor={TEXT_MUTED}
                            />
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Working / Collection Hours</Text>
                            <TextInput
                                style={styles.textInput}
                                value={workingHours}
                                onChangeText={setWorkingHours}
                                placeholder="e.g. Mon - Sat: 9:00 AM - 6:00 PM"
                                placeholderTextColor={TEXT_MUTED}
                            />
                        </View>
                    </View>
                )}

                <View style={styles.divider} />

                {/* Same-Day Rush Delivery */}
                <View style={styles.optionRow}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="flash-outline" size={17} color="#F59E0B" />
                            <Text style={styles.optionTitle}>Express / Same-Day Dispatch</Text>
                        </View>
                        <Text style={styles.optionDesc}>
                            Show badge that your store prepares and dispatches orders within 6 hours.
                        </Text>
                    </View>
                    <Switch
                        value={supportsExpress}
                        onValueChange={setSupportsExpress}
                        trackColor={{ false: '#CBD5E1', true: EMERALD }}
                        thumbColor="#FFFFFF"
                    />
                </View>

                <View style={styles.divider} />

                {/* Free Shipping Promotion */}
                <View style={styles.optionRow}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="gift-outline" size={17} color={GOLD_DARK} />
                            <Text style={styles.optionTitle}>Free Shipping Promotion Threshold</Text>
                        </View>
                        <Text style={styles.optionDesc}>
                            Offer free delivery for buyers ordering over a minimum cart total.
                        </Text>
                    </View>
                    <Switch
                        value={freeShippingEnabled}
                        onValueChange={setFreeShippingEnabled}
                        trackColor={{ false: '#CBD5E1', true: EMERALD }}
                        thumbColor="#FFFFFF"
                    />
                </View>

                {freeShippingEnabled && (
                    <View style={styles.pickupDetailsBox}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Minimum Order Value for Free Delivery (₦)</Text>
                            <TextInput
                                style={styles.textInput}
                                keyboardType="numeric"
                                value={freeShippingThreshold}
                                onChangeText={setFreeShippingThreshold}
                                placeholder="e.g. 50000"
                                placeholderTextColor={TEXT_MUTED}
                            />
                            <Text style={styles.inputHint}>Orders above this cart subtotal will get free doorstep dispatch.</Text>
                        </View>
                    </View>
                )}
            </View>

            {/* Handling Notes & Policy */}
            <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                    <Ionicons name="document-text-outline" size={18} color={NAVY_DARK} />
                    <Text style={styles.cardSectionTitle}>Dispatch & Waybill Notes for Buyers</Text>
                </View>
                <TextInput
                    style={[styles.textInput, { height: 75, textAlignVertical: 'top', paddingTop: 10 }]}
                    multiline
                    numberOfLines={3}
                    value={dispatchNotes}
                    onChangeText={setDispatchNotes}
                    placeholder="e.g. All parcels are packaged in security wrap. Waybill slips and tracking receipt numbers are provided via WhatsApp once handed to park drivers."
                    placeholderTextColor={TEXT_MUTED}
                />
            </View>

            {/* Save Button */}
            <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
            >
                {saving ? (
                    <ActivityIndicator size="small" color={NAVY_DARK} />
                ) : (
                    <>
                        <Ionicons name="checkmark-done" size={20} color={NAVY_DARK} />
                        <Text style={styles.saveBtnText}>Save & Apply Logistics Settings</Text>
                    </>
                )}
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
        paddingBottom: 120,
        backgroundColor: CANVAS_BG
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
        marginBottom: 14
    },
    title: {
        fontSize: 19,
        fontWeight: '900',
        color: NAVY_DARK,
        letterSpacing: -0.3
    },
    sub: {
        fontSize: 12,
        color: TEXT_SECONDARY,
        marginTop: 3,
        lineHeight: 17
    },
    backBtnHeader: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: BORDER_COLOR
    },
    bannerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderRadius: 16,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.35)'
    },
    bannerIconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.3)'
    },
    bannerTitle: {
        fontSize: 13.5,
        fontWeight: '900',
        color: '#FFFFFF'
    },
    liveTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: EMERALD
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: EMERALD
    },
    liveTagText: {
        fontSize: 9,
        fontWeight: '900',
        color: '#A7F3D0'
    },
    bannerSub: {
        fontSize: 11,
        color: '#CBD5E1',
        marginTop: 4,
        lineHeight: 15
    },
    card: {
        backgroundColor: CARD_BG,
        borderRadius: 18,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: BORDER_COLOR,
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 1
    },
    cardHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4
    },
    toggleCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14
    },
    switchIconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: BORDER_COLOR
    },
    toggleCardTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: NAVY_DARK
    },
    toggleCardSub: {
        fontSize: 11,
        color: TEXT_SECONDARY,
        marginTop: 2,
        lineHeight: 15,
        maxWidth: 220
    },
    cardSectionTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: NAVY_DARK
    },
    cardSectionSub: {
        fontSize: 11.5,
        color: TEXT_MUTED,
        marginTop: 2,
        marginBottom: 14
    },
    inputGroup: {
        marginBottom: 12
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 5
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 4
    },
    reqStar: {
        color: '#EF4444',
        fontWeight: '800',
        fontSize: 12
    },
    textInput: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: BORDER_COLOR,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 13.5,
        fontWeight: '700',
        color: NAVY_DARK
    },
    inputHint: {
        fontSize: 10.5,
        color: TEXT_MUTED,
        marginTop: 4
    },
    channelCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 12,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: BORDER_COLOR
    },
    channelCardSelected: {
        backgroundColor: GOLD_SURFACE,
        borderColor: GOLD
    },
    channelIconBox: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center'
    },
    channelTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: TEXT_PRIMARY
    },
    channelBadge: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 4
    },
    channelBadgeText: {
        fontSize: 9,
        fontWeight: '800',
        color: TEXT_SECONDARY
    },
    channelDesc: {
        fontSize: 10.5,
        color: TEXT_MUTED,
        marginTop: 2
    },
    checkboxCircle: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 1.5,
        borderColor: '#CBD5E1',
        alignItems: 'center',
        justifyContent: 'center'
    },
    checkboxCircleActive: {
        backgroundColor: NAVY_DARK,
        borderColor: NAVY_DARK
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8
    },
    optionTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: NAVY_DARK
    },
    optionDesc: {
        fontSize: 11,
        color: TEXT_SECONDARY,
        marginTop: 2,
        lineHeight: 15
    },
    pickupDetailsBox: {
        marginTop: 10,
        backgroundColor: '#F8FAFC',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: BORDER_COLOR
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
        gap: 8,
        marginTop: 6,
        shadowColor: GOLD,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 2
    },
    saveBtnText: {
        fontSize: 14.5,
        fontWeight: '900',
        color: NAVY_DARK
    }
});
