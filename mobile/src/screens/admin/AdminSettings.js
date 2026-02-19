import React, { useState } from 'react';
import { View, Text, Switch, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSettings } from '../../context/AppSettingsContext';
import * as ImagePicker from 'expo-image-picker';
import { UploadService } from '../../services/uploadService';

export const AdminSettings = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const { settings, updateSettings, refreshSettings } = useAppSettings();
    const [loading, setLoading] = useState(false);
    // Local state for edits
    const [appName, setAppName] = useState(settings?.app_name || '');
    const [logoUrl, setLogoUrl] = useState(settings?.logo_url || null);
    const [certLogoUrl, setCertLogoUrl] = useState(settings?.cert_logo_url || null);
    const [certBadgeUrl, setCertBadgeUrl] = useState(settings?.cert_badge_url || null);
    const [certSignatureUrl, setCertSignatureUrl] = useState(settings?.cert_signature_url || null);
    const [primaryColor, setPrimaryColor] = useState(settings?.primary_color || '#0F172A');
    const [secondaryColor, setSecondaryColor] = useState(settings?.secondary_color || '#3B82F6');
    const [paymentMethods, setPaymentMethods] = useState(settings?.payment_methods || {});
    const [features, setFeatures] = useState(settings?.features || {});

    // Upload states
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [uploadingCertLogo, setUploadingCertLogo] = useState(false);
    const [uploadingCertBadge, setUploadingCertBadge] = useState(false);
    const [uploadingCertSignature, setUploadingCertSignature] = useState(false);

    const handleSave = async () => {
        setLoading(true);
        const { error } = await updateSettings({
            app_name: appName,
            logo_url: logoUrl,
            logo_url: logoUrl,
            cert_logo_url: certLogoUrl,
            cert_badge_url: certBadgeUrl,
            cert_signature_url: certSignatureUrl,
            primary_color: primaryColor,
            secondary_color: secondaryColor,
            payment_methods: paymentMethods,
            features: features
        });
        setLoading(false);
        if (error) {
            Alert.alert('Error', 'Failed to update settings');
        } else {
            Alert.alert('Success', 'Settings updated successfully');
            if (refreshSettings) refreshSettings();
        }
    };

    const handlePickImage = async (type) => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.8,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];

                if (type === 'logo') setUploadingLogo(true);
                else if (type === 'cert_logo') setUploadingCertLogo(true);
                else if (type === 'cert_badge') setUploadingCertBadge(true);
                else if (type === 'cert_signature') setUploadingCertSignature(true);

                try {
                    const publicUrl = await UploadService.uploadFile(asset, 'app-assets', 'logos');

                    if (type === 'logo') setLogoUrl(publicUrl);
                    else if (type === 'cert_logo') setCertLogoUrl(publicUrl);
                    else if (type === 'cert_badge') setCertBadgeUrl(publicUrl);
                    else if (type === 'cert_signature') setCertSignatureUrl(publicUrl);

                    Alert.alert('Uploaded', 'Remember to click Save.');
                } catch (uploadError) {
                    console.log('Upload Error:', uploadError);
                    Alert.alert('Upload Failed', 'Check permissions.');
                } finally {
                    setUploadingLogo(false);
                    setUploadingCertLogo(false);
                    setUploadingCertBadge(false);
                    setUploadingCertSignature(false);
                }
            }
        } catch (error) {
            console.log('Pick Error:', error);
        }
    };

    const togglePaymentMethod = (method) => {
        setPaymentMethods(prev => {
            const isEnabled = prev[method] !== false;
            return { ...prev, [method]: !isEnabled };
        });
    };

    const toggleFeature = (feature) => {
        setFeatures(prev => ({ ...prev, [feature]: !prev[feature] }));
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            {/* Header */}
            <View style={{
                paddingTop: insets.top + 10,
                paddingBottom: 16,
                paddingHorizontal: 20,
                backgroundColor: 'white',
                borderBottomWidth: 1,
                borderColor: '#F1F5F9',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 16 }}>
                        <Ionicons name="arrow-back" size={24} color="#0F172A" />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 20, fontWeight: '800', color: '#0F172A' }}>App Settings</Text>
                </View>
                <TouchableOpacity onPress={handleSave} disabled={loading}>
                    {loading ? <ActivityIndicator size="small" color="#3B82F6" /> : (
                        <Text style={{ color: '#3B82F6', fontWeight: '700', fontSize: 16 }}>Save</Text>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>
                {/* Branding Section */}
                <Text style={styles.sectionTitle}>Branding</Text>
                <View style={styles.card}>
                    {/* App Logo */}
                    <Text style={styles.label}>App Logo (Header/Auth)</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                        <View style={{ width: 60, height: 60, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' }}>
                            {logoUrl ? <Image source={{ uri: logoUrl }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : <Ionicons name="image-outline" size={24} color="#CBD5E1" />}
                        </View>
                        <TouchableOpacity
                            style={styles.uploadBtn}
                            onPress={() => handlePickImage('logo')}
                            disabled={uploadingLogo}
                        >
                            {uploadingLogo ? <ActivityIndicator size="small" color="#4F46E5" /> : <Ionicons name="cloud-upload-outline" size={18} color="#4F46E5" />}
                            <Text style={styles.uploadText}>{uploadingLogo ? 'Uploading...' : 'Change Logo'}</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.label}>App Name</Text>
                    <TextInput style={styles.input} value={appName} onChangeText={setAppName} />

                    <Text style={styles.label}>Primary Color</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 24, height: 24, borderRadius: 4, backgroundColor: primaryColor, marginRight: 10, borderWidth: 1, borderColor: '#ddd' }} />
                        <TextInput style={[styles.input, { flex: 1 }]} value={primaryColor} onChangeText={setPrimaryColor} />
                    </View>

                    <Text style={styles.label}>Secondary Color</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 24, height: 24, borderRadius: 4, backgroundColor: secondaryColor, marginRight: 10, borderWidth: 1, borderColor: '#ddd' }} />
                        <TextInput style={[styles.input, { flex: 1 }]} value={secondaryColor} onChangeText={setSecondaryColor} />
                    </View>
                </View>

                {/* Certificate Settings */}
                <Text style={styles.sectionTitle}>Certificate Settings</Text>
                <View style={styles.card}>
                    {/* Cert Logo */}
                    <Text style={styles.label}>Certificate Logo (Top)</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                        <View style={{ width: 60, height: 60, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' }}>
                            {certLogoUrl ? <Image source={{ uri: certLogoUrl }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : <Ionicons name="document-text-outline" size={24} color="#CBD5E1" />}
                        </View>
                        <TouchableOpacity
                            style={styles.uploadBtn}
                            onPress={() => handlePickImage('cert_logo')}
                            disabled={uploadingCertLogo}
                        >
                            {uploadingCertLogo ? <ActivityIndicator size="small" color="#4F46E5" /> : <Ionicons name="cloud-upload-outline" size={18} color="#4F46E5" />}
                            <Text style={styles.uploadText}>{uploadingCertLogo ? 'Uploading...' : 'Upload Logo'}</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Cert Badge */}
                    <Text style={styles.label}>Certificate Badge/Seal (Bottom)</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 60, height: 60, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' }}>
                            {certBadgeUrl ? <Image source={{ uri: certBadgeUrl }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : <Ionicons name="shield-checkmark-outline" size={24} color="#CBD5E1" />}
                        </View>
                        <TouchableOpacity
                            style={styles.uploadBtn}
                            onPress={() => handlePickImage('cert_badge')}
                            disabled={uploadingCertBadge}
                        >
                            {uploadingCertBadge ? <ActivityIndicator size="small" color="#4F46E5" /> : <Ionicons name="cloud-upload-outline" size={18} color="#4F46E5" />}
                            <Text style={styles.uploadText}>{uploadingCertBadge ? 'Uploading...' : 'Upload Badge'}</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Cert Signature */}
                    <Text style={styles.label}>Certificate Signature (Left)</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 100, height: 40, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' }}>
                            {certSignatureUrl ? <Image source={{ uri: certSignatureUrl }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : <Ionicons name="pencil-outline" size={24} color="#CBD5E1" />}
                        </View>
                        <TouchableOpacity
                            style={styles.uploadBtn}
                            onPress={() => handlePickImage('cert_signature')}
                            disabled={uploadingCertSignature}
                        >
                            {uploadingCertSignature ? <ActivityIndicator size="small" color="#4F46E5" /> : <Ionicons name="cloud-upload-outline" size={18} color="#4F46E5" />}
                            <Text style={styles.uploadText}>{uploadingCertSignature ? 'Uploading...' : 'Upload Sign'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Payment Methods */}
                <Text style={styles.sectionTitle}>Payment Methods</Text>
                <View style={styles.card}>
                    <ToggleItem
                        label="Paystack (Card/Bank)"
                        value={paymentMethods.paystack !== false}
                        onToggle={() => togglePaymentMethod('paystack')}
                    />
                    <ToggleItem
                        label="Cryptocurrency (Coinbase)"
                        value={paymentMethods.crypto !== false}
                        onToggle={() => togglePaymentMethod('crypto')}
                    />
                    <ToggleItem
                        label="Manual Transfer"
                        value={paymentMethods.manual !== false}
                        onToggle={() => togglePaymentMethod('manual')}
                    />
                    <ToggleItem
                        label="Flutterwave"
                        value={paymentMethods.flutterwave !== false}
                        onToggle={() => togglePaymentMethod('flutterwave')}
                    />
                </View>

                {/* Features */}
                <Text style={styles.sectionTitle}>Features & Locks</Text>
                <View style={styles.card}>
                    <ToggleItem
                        label="Enable Vendor Registration"
                        value={features.enable_vendor_registration !== false} // Default true
                        onToggle={() => toggleFeature('enable_vendor_registration')}
                    />
                    <ToggleItem
                        label="Maintenance Mode (Lock App)"
                        value={features.maintenance_mode || false}
                        onToggle={() => toggleFeature('maintenance_mode')}
                        color="red"
                    />
                </View>

            </ScrollView>
        </View>
    );
};

const ToggleItem = ({ label, value, onToggle, color = '#3B82F6' }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F1F5F9' }}>
        <Text style={{ fontSize: 16, color: '#334155' }}>{label}</Text>
        <Switch
            value={!!value}
            onValueChange={onToggle}
            trackColor={{ false: '#767577', true: color }}
            thumbColor={value ? 'white' : '#f4f3f4'}
        />
    </View>
);

const styles = {
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#64748B',
        marginBottom: 10,
        marginTop: 10
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#475569',
        marginBottom: 6,
        marginTop: 10
    },
    input: {
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: '#0F172A',
        backgroundColor: '#F8FAFC'
    }
};
