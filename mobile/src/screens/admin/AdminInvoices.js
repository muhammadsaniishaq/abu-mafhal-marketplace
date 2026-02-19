import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Modal, ScrollView, Alert, Share, Image, TextInput } from 'react-native';
import { styles } from '../../styles/theme';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { sendInvoiceEmail, generateInvoiceHTML } from '../../lib/emailService';
import { WebView } from 'react-native-webview';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

export const AdminInvoices = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState(null);

    // Settings State
    const [showSettings, setShowSettings] = useState(false);
    const [settings, setSettings] = useState({
        name: 'Abu Mafhal Ltd',
        address: '123 Goni Aji Street, Gashua, Yobe State',
        phone: '+234 814 585 3539',
        email: 'support@abumafhal.com',
        logo_url: null,
        stamp_url: null,
        signature_url: null,
        footer_text: 'Thank you for your patronage!'
    });
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        fetchOrders();
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        const { data } = await supabase.from('business_settings').select('*').single();
        if (data) setSettings(data);
    };

    const fetchOrders = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('orders')
            .select('*, user:profiles(full_name, email, phone), order_items(*, products(*))')
            .order('created_at', { ascending: false })
            .limit(20);
        setOrders(data || []);
        setLoading(false);
    };

    const saveSettings = async () => {
        setUploading(true);
        const { error } = await supabase.from('business_settings').upsert({ id: 'default', ...settings });
        setUploading(false);
        if (error) Alert.alert('Error', error.message);
        else {
            Alert.alert('Success', 'Invoice settings updated!');
            setShowSettings(false);
        }
    };

    const pickImage = async (field) => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
            base64: true
        });

        if (!result.canceled) {
            uploadImage(result.assets[0].base64, field);
        }
    };

    const uploadImage = async (base64, field) => {
        try {
            setUploading(true);
            const fileName = `${field}_${Date.now()}.png`;
            const { data, error } = await supabase.storage
                .from('business_assets')
                .upload(fileName, decode(base64), { contentType: 'image/png', upsert: true });

            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage.from('business_assets').getPublicUrl(fileName);

            setSettings(prev => ({ ...prev, [field]: publicUrl }));
            setUploading(false);
        } catch (e) {
            Alert.alert('Upload Failed', e.message);
            setUploading(false);
        }
    };

    const handleShareInvoice = async () => {
        try {
            const message = `Invoice #${selectedOrder.id.slice(0, 8)}\nDate: ${new Date(selectedOrder.created_at).toDateString()}\nTotal: ₦${selectedOrder.total_amount}\n\nThank you for shopping with Abu Mafhal!`;
            await Share.share({ message });
        } catch (error) {
            Alert.alert(error.message);
        }
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity
            onPress={() => setSelectedOrder(item)}
            style={{ backgroundColor: 'white', padding: 16, borderBottomWidth: 1, borderColor: '#F1F5F9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
            <View>
                <Text style={{ fontWeight: '700', color: '#0F172A' }}>INV-{item.id.slice(0, 8).toUpperCase()}</Text>
                <Text style={{ fontSize: 12, color: '#64748B' }}>{item.user?.full_name || 'Customer'}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ fontWeight: '600', color: '#334155' }}>₦{item.total_amount?.toLocaleString()}</Text>
                <Ionicons name="chevron-forward" color="#CBD5E1" size={16} />
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={{ flex: 1, backgroundColor: 'white' }}>
            <View style={{ padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.sectionTitle}>Invoice Manager</Text>
                <TouchableOpacity onPress={() => setShowSettings(true)} style={{ padding: 8 }}>
                    <Ionicons name="settings-outline" size={24} color="#0F172A" />
                </TouchableOpacity>
            </View>

            <FlatList
                data={orders}
                renderItem={renderItem}
                keyExtractor={item => item.id}
            />

            {/* PREVIEW MODAL */}
            <Modal visible={!!selectedOrder} animationType="slide" onRequestClose={() => setSelectedOrder(null)}>
                <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
                    <View style={{ padding: 20, backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 18, fontWeight: '800' }}>Invoice Preview</Text>
                        <TouchableOpacity onPress={() => setSelectedOrder(null)}><Ionicons name="close" size={24} /></TouchableOpacity>
                    </View>

                    {selectedOrder && (
                        <View style={{ flex: 1 }}>
                            {/* PASS SETTINGS HERE */}
                            <WebView
                                source={{
                                    html: generateInvoiceHTML({
                                        id: `INV-${selectedOrder.id.slice(0, 8).toUpperCase()}`,
                                        grandTotal: selectedOrder.total_amount,
                                        status: selectedOrder.status?.toUpperCase() || 'PAID',
                                        issuedAt: selectedOrder.created_at,
                                        customerName: selectedOrder.user?.full_name,
                                        customerPhone: selectedOrder.user?.phone,
                                        items: selectedOrder.order_items && selectedOrder.order_items.length > 0
                                            ? selectedOrder.order_items.map(item => {
                                                const product = item.products || {};
                                                const name = product.title || product.name || 'Product';
                                                const brand = product.brand ? `${product.brand} ` : '';
                                                return {
                                                    description: `${brand}${name}`,
                                                    quantity: item.quantity,
                                                    price: item.price
                                                };
                                            })
                                            : [{ description: "Order Items", quantity: 1, price: selectedOrder.total_amount }]
                                    }, settings)
                                }}
                                style={{ flex: 1, backgroundColor: 'transparent' }}
                                originWhitelist={['*']}
                                javaScriptEnabled={true}
                                domStorageEnabled={true}
                            />

                            <View style={{ backgroundColor: 'white', borderTopWidth: 1, borderColor: '#eee', padding: 20 }}>
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <TouchableOpacity
                                        onPress={async () => {
                                            // Send with current settings!
                                            try {
                                                if (!selectedOrder.user?.email) { return Alert.alert('Error', 'No email'); }
                                                Alert.alert('Sending...', 'Sending email...');

                                                const invoiceData = {
                                                    id: `INV-${selectedOrder.id.slice(0, 8).toUpperCase()}`,
                                                    grandTotal: selectedOrder.total_amount,
                                                    status: selectedOrder.status?.toUpperCase() || 'PAID',
                                                    issuedAt: selectedOrder.created_at,
                                                    customerName: selectedOrder.user.full_name,
                                                    items: selectedOrder.order_items && selectedOrder.order_items.length > 0
                                                        ? selectedOrder.order_items.map(item => {
                                                            const product = item.products || {};
                                                            const name = product.title || product.name || 'Product';
                                                            const brand = product.brand ? `${product.brand} ` : '';
                                                            return {
                                                                description: `${brand}${name}`,
                                                                quantity: item.quantity,
                                                                price: item.price
                                                            };
                                                        })
                                                        : [{ description: "Order Items", quantity: 1, price: selectedOrder.total_amount }]
                                                };
                                                // Pass settings to email service logic if needed, 
                                                // BUT emailService generateHTML needs to fetch settings or be passed settings.
                                                // Currently emailService generateHTML is separate.
                                                // Better: Pass settings to sendInvoiceEmail, and update sendInvoiceEmail to use passed settings or defaults.
                                                // NOTE: I updated generateInvoiceHTML to take (invoice, business). emailService uses it.
                                                // I need to update sendInvoiceEmail signature or how it calls generateInvoiceHTML.
                                                // Let's pass settings as 3rd arg? Or inside invoice object?
                                                // Let's assume sendInvoiceEmail handles it.
                                                // Wait, sendInvoiceEmail calls generateInvoiceHTML(invoice). 
                                                // I should update sendInvoiceEmail in emailService.js to accept settings.
                                                await sendInvoiceEmail({ ...invoiceData }, selectedOrder.user.email, settings);
                                                Alert.alert('Success', 'Sent!');
                                            } catch (e) { Alert.alert('Error', e.message); }
                                        }}
                                        style={{ flex: 1, backgroundColor: '#0F172A', padding: 16, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                                    >
                                        <Ionicons name="mail-outline" color="white" size={20} />
                                        <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Send Email</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    )}
                </View>
            </Modal>

            {/* SETTINGS MODAL */}
            <Modal visible={showSettings} animationType="slide" onRequestClose={() => setShowSettings(false)}>
                <View style={{ flex: 1, backgroundColor: 'white' }}>
                    <View style={{ padding: 20, borderBottomWidth: 1, borderColor: '#eee', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 18, fontWeight: '800' }}>Invoice Settings</Text>
                        <TouchableOpacity onPress={() => setShowSettings(false)}><Ionicons name="close" size={24} /></TouchableOpacity>
                    </View>
                    <ScrollView style={{ padding: 20 }}>
                        <Text style={styles.label}>Business Name</Text>
                        <TextInput style={styles.input} value={settings.name} onChangeText={t => setSettings({ ...settings, name: t })} />

                        <Text style={styles.label}>Address</Text>
                        <TextInput style={styles.input} value={settings.address} onChangeText={t => setSettings({ ...settings, address: t })} />

                        <Text style={styles.label}>Phone</Text>
                        <TextInput style={styles.input} value={settings.phone} onChangeText={t => setSettings({ ...settings, phone: t })} />

                        <View style={{ marginTop: 20, padding: 16, backgroundColor: '#EFF6FF', borderRadius: 8, borderWidth: 1, borderColor: '#DBEAFE' }}>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: '#1E40AF', marginBottom: 8 }}>Resend Verified Sender</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: 'white', borderColor: '#BFDBFE' }]}
                                value={settings.sender_email}
                                placeholder="support@abumafhal.com"
                                onChangeText={t => setSettings({ ...settings, sender_email: t })}
                            />
                        </View>

                        <Text style={{ fontSize: 16, fontWeight: '700', marginTop: 20, marginBottom: 10 }}>Branding Assets</Text>

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity onPress={() => pickImage('logo_url')} style={{ flex: 1, height: 100, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                                {settings.logo_url ? <Image source={{ uri: settings.logo_url }} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} /> : <Text style={{ color: '#94a3b8' }}>Upload Logo</Text>}
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => pickImage('stamp_url')} style={{ flex: 1, height: 100, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                                {settings.stamp_url ? <Image source={{ uri: settings.stamp_url }} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} /> : <Text style={{ color: '#94a3b8' }}>Upload Stamp</Text>}
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => pickImage('signature_url')} style={{ flex: 1, height: 100, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                                {settings.signature_url ? <Image source={{ uri: settings.signature_url }} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} /> : <Text style={{ color: '#94a3b8' }}>Upload Sig</Text>}
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity onPress={saveSettings} style={{ backgroundColor: '#0F172A', padding: 18, borderRadius: 12, marginTop: 40, alignItems: 'center' }}>
                            <Text style={{ color: 'white', fontWeight: 'bold' }}>{uploading ? 'Topawa...' : 'Save Settings'}</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </Modal>
        </View>
    );
};
