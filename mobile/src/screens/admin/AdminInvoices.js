import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    View, Text, FlatList, TouchableOpacity, Modal, ScrollView, 
    Alert, Share, Image, TextInput, StyleSheet, ActivityIndicator, 
    RefreshControl, Platform 
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { sendInvoiceEmail, generateInvoiceHTML } from '../../lib/emailService';
import { WebView } from 'react-native-webview';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

const NAVY = '#0E1A2E';
const DEEP_NAVY = '#1E293B';
const GOLD = '#D9A73A';

export const AdminInvoices = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [search, setSearch] = useState('');

    // Settings State
    const [showSettings, setShowSettings] = useState(false);
    const [settings, setSettings] = useState({
        name: 'Abu Mafhal Ltd',
        address: '123 Goni Aji Street, Gashua, Yobe State',
        phone: '+234 814 585 3539',
        email: 'support@abumafhal.com',
        sender_email: 'support@abumafhal.com',
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
        try {
            const { data } = await supabase.from('business_settings').select('*').maybeSingle();
            if (data) setSettings(prev => ({ ...prev, ...data }));
        } catch (e) {
            console.warn('Fetch invoice settings error:', e);
        }
    };

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('*, user:profiles(full_name, email, phone), order_items(*, products(*))')
                .order('created_at', { ascending: false })
                .limit(50);
            if (data) setOrders(data);
            if (error) console.warn('Fetch invoice orders error:', error.message);
        } catch (e) {
            console.error('Fetch invoice orders catch:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchOrders();
    };

    const saveSettings = async () => {
        setUploading(true);
        try {
            const { error } = await supabase.from('business_settings').upsert({ id: 'default', ...settings });
            if (error) throw error;
            Alert.alert('Updated', 'Invoice settings updated successfully!');
            setShowSettings(false);
        } catch (e) {
            Alert.alert('Error', e.message);
        } finally {
            setUploading(false);
        }
    };

    const pickImage = async (field) => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.6,
            base64: true
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            await uploadImage(result.assets[0].base64, field);
        }
    };

    const uploadImage = async (base64, field) => {
        try {
            setUploading(true);
            const fileName = `${field}_${Date.now()}.png`;
            const fileData = decode(base64);

            let uploadRes = await supabase.storage
                .from('business_assets')
                .upload(fileName, fileData, { contentType: 'image/png', upsert: true });

            let bucket = 'business_assets';
            if (uploadRes.error) {
                uploadRes = await supabase.storage
                    .from('products')
                    .upload(fileName, fileData, { contentType: 'image/png', upsert: true });
                bucket = 'products';
            }

            if (uploadRes.error) throw uploadRes.error;

            const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);
            setSettings(prev => ({ ...prev, [field]: publicUrl }));
            Alert.alert('Upload Successful', 'Branding asset uploaded successfully!');
        } catch (e) {
            Alert.alert('Upload Error', e.message);
        } finally {
            setUploading(false);
        }
    };

    const handleShareInvoice = async () => {
        if (!selectedOrder) return;
        try {
            const message = `Purchase Receipt #${selectedOrder.id.slice(0, 8).toUpperCase()}\nDate: ${new Date(selectedOrder.created_at).toDateString()}\nTotal Amount: ₦${Number(selectedOrder.total_amount || 0).toLocaleString()}\nCustomer: ${selectedOrder.user?.full_name || 'Customer'}\n\nThank you for shopping with Abu Mafhal!`;
            await Share.share({ message });
        } catch (error) {
            Alert.alert('Error', error.message);
        }
    };

    const filteredOrders = useMemo(() => {
        if (!search.trim()) return orders;
        const q = search.toLowerCase();
        return orders.filter(o => 
            o.id.toLowerCase().includes(q) ||
            (o.user?.full_name && o.user.full_name.toLowerCase().includes(q)) ||
            (o.user?.phone && o.user.phone.includes(q)) ||
            (o.status && o.status.toLowerCase().includes(q))
        );
    }, [orders, search]);

    const renderItem = ({ item }) => {
        const orderCode = `INV-${item.id.slice(0, 8).toUpperCase()}`;
        const isPaid = item.payment_status === 'paid' || item.status === 'delivered';
        return (
            <TouchableOpacity
                onPress={() => setSelectedOrder(item)}
                style={s.orderRow}
                activeOpacity={0.8}
            >
                <View style={s.orderIconCircle}>
                    <Ionicons name="receipt-outline" size={20} color={GOLD} />
                </View>

                <View style={{ flex: 1, marginRight: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <Text style={s.orderCodeText}>{orderCode}</Text>
                        <View style={[s.statusPill, { backgroundColor: isPaid ? '#ECFDF5' : '#FFFBEB' }]}>
                            <Text style={[s.statusPillText, { color: isPaid ? '#059669' : '#D97706' }]}>
                                {item.status?.toUpperCase() || 'PENDING'}
                            </Text>
                        </View>
                    </View>
                    <Text style={s.customerNameText} numberOfLines={1}>
                        {item.user?.full_name || 'Customer'} · {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.amountText}>₦{Number(item.total_amount || 0).toLocaleString()}</Text>
                    <Ionicons name="chevron-forward" color="#CBD5E1" size={16} style={{ marginTop: 2 }} />
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={s.container}>
            {/* Header */}
            <View style={s.header}>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="receipt" size={22} color={GOLD} />
                        <Text style={s.headerTitle}>Invoices</Text>
                    </View>
                    <Text style={s.headerSubtitle}>View receipts, print PDF invoices, or share with customers</Text>
                </View>
                <TouchableOpacity 
                    onPress={() => setShowSettings(true)} 
                    style={s.settingsBtn}
                    activeOpacity={0.8}
                >
                    <Ionicons name="settings-outline" size={18} color={NAVY} />
                    <Text style={s.settingsBtnText}>Settings</Text>
                </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={s.searchWrap}>
                <Ionicons name="search" size={16} color={GOLD} />
                <TextInput
                    style={s.searchInput}
                    placeholder="Search by invoice ID or customer name..."
                    placeholderTextColor="#94A3B8"
                    value={search}
                    onChangeText={setSearch}
                />
                {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')}>
                        <Ionicons name="close-circle" size={17} color="#94A3B8" />
                    </TouchableOpacity>
                )}
            </View>

            {loading ? (
                <View style={s.centered}>
                    <ActivityIndicator size="large" color={GOLD} />
                    <Text style={s.loadingText}>Loading invoices...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredOrders}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[GOLD, NAVY]} />}
                    ListEmptyComponent={
                        <View style={s.emptyBox}>
                            <View style={s.emptyIconCircle}>
                                <Ionicons name="receipt-outline" size={38} color={GOLD} />
                            </View>
                            <Text style={s.emptyTitle}>No Invoices Found</Text>
                            <Text style={s.emptySub}>
                                {search ? `No invoices match "${search}"` : "No order invoices found in store records."}
                            </Text>
                        </View>
                    }
                />
            )}

            {/* PREVIEW MODAL */}
            <Modal visible={!!selectedOrder} animationType="slide" onRequestClose={() => setSelectedOrder(null)}>
                <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
                    <View style={s.modalHeaderBar}>
                        <View>
                            <Text style={s.modalHeaderTitle}>Invoice Preview</Text>
                            <Text style={s.modalHeaderSub}>{selectedOrder ? `INV-${selectedOrder.id.slice(0, 8).toUpperCase()}` : ''}</Text>
                        </View>
                        <TouchableOpacity onPress={() => setSelectedOrder(null)} style={s.closeCircleBtn}>
                            <Ionicons name="close" size={20} color={NAVY} />
                        </TouchableOpacity>
                    </View>

                    {selectedOrder && (
                        <View style={{ flex: 1 }}>
                            {Platform.OS === 'web' ? (
                                <iframe
                                    srcDoc={generateInvoiceHTML({
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
                                    }, settings)}
                                    style={{ flex: 1, border: 'none', width: '100%', height: '100%' }}
                                />
                            ) : (
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
                            )}

                            {/* Bottom Action Bar */}
                            <View style={s.previewActionBar}>
                                <TouchableOpacity
                                    onPress={handleShareInvoice}
                                    style={s.shareBtn}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="share-social-outline" color={NAVY} size={18} />
                                    <Text style={s.shareBtnText}>Share</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={async () => {
                                        try {
                                            if (!selectedOrder.user?.email) {
                                                Alert.alert('No Email', 'This customer does not have an email address.');
                                                return;
                                            }
                                            Alert.alert('Sending...', 'Sending invoice to ' + selectedOrder.user.email);

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
                                            await sendInvoiceEmail({ ...invoiceData }, selectedOrder.user.email, settings);
                                            Alert.alert('Sent Successfully! ✉️', 'Invoice sent to customer successfully.');
                                        } catch (e) {
                                            Alert.alert('Error', e.message);
                                        }
                                    }}
                                    style={s.emailBtn}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="mail" color={NAVY} size={18} />
                                    <Text style={s.emailBtnText}>Send Email</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>
            </Modal>

            {/* SETTINGS MODAL */}
            <Modal visible={showSettings} animationType="slide" onRequestClose={() => setShowSettings(false)}>
                <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
                    <View style={s.modalHeaderBar}>
                        <View>
                            <Text style={s.modalHeaderTitle}>Invoice Settings</Text>
                            <Text style={s.modalHeaderSub}>Company details, address, and branding assets</Text>
                        </View>
                        <TouchableOpacity onPress={() => setShowSettings(false)} style={s.closeCircleBtn}>
                            <Ionicons name="close" size={20} color={NAVY} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={{ padding: 20 }}>
                        <Text style={s.inputLabel}>Business Name</Text>
                        <TextInput 
                            style={s.settingsInput} 
                            value={settings.name} 
                            onChangeText={t => setSettings({ ...settings, name: t })} 
                        />

                        <Text style={s.inputLabel}>Business Address</Text>
                        <TextInput 
                            style={s.settingsInput} 
                            value={settings.address} 
                            onChangeText={t => setSettings({ ...settings, address: t })} 
                        />

                        <Text style={s.inputLabel}>Phone Number</Text>
                        <TextInput 
                            style={s.settingsInput} 
                            value={settings.phone} 
                            onChangeText={t => setSettings({ ...settings, phone: t })} 
                        />

                        <Text style={s.inputLabel}>Verified Sender Email</Text>
                        <TextInput
                            style={s.settingsInput}
                            value={settings.sender_email}
                            placeholder="support@abumafhal.com"
                            placeholderTextColor="#94A3B8"
                            onChangeText={t => setSettings({ ...settings, sender_email: t })}
                        />

                        <Text style={s.brandingSectionTitle}>Branding & Official Assets</Text>
                        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                            <TouchableOpacity onPress={() => pickImage('logo_url')} style={s.assetBox} activeOpacity={0.8}>
                                {settings.logo_url ? (
                                    <Image source={{ uri: settings.logo_url }} style={s.assetImage} />
                                ) : (
                                    <View style={{ alignItems: 'center' }}>
                                        <Ionicons name="image-outline" size={24} color={GOLD} />
                                        <Text style={s.assetLabel}>Logo</Text>
                                    </View>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => pickImage('stamp_url')} style={s.assetBox} activeOpacity={0.8}>
                                {settings.stamp_url ? (
                                    <Image source={{ uri: settings.stamp_url }} style={s.assetImage} />
                                ) : (
                                    <View style={{ alignItems: 'center' }}>
                                        <Ionicons name="shield-checkmark-outline" size={24} color={GOLD} />
                                        <Text style={s.assetLabel}>Official Stamp</Text>
                                    </View>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => pickImage('signature_url')} style={s.assetBox} activeOpacity={0.8}>
                                {settings.signature_url ? (
                                    <Image source={{ uri: settings.signature_url }} style={s.assetImage} />
                                ) : (
                                    <View style={{ alignItems: 'center' }}>
                                        <Ionicons name="pencil-outline" size={24} color={GOLD} />
                                        <Text style={s.assetLabel}>Authorized Sig</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity 
                            onPress={saveSettings} 
                            style={s.saveSettingsBtn}
                            disabled={uploading}
                            activeOpacity={0.85}
                        >
                            {uploading ? (
                                <ActivityIndicator color={NAVY} />
                            ) : (
                                <Text style={s.saveSettingsBtnText}>Save Invoice Settings</Text>
                            )}
                        </TouchableOpacity>

                        <View style={{ height: 40 }} />
                    </ScrollView>
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
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 20 : 16,
        paddingBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: NAVY
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2
    },
    settingsBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#FFFBEB',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#FDE68A'
    },
    settingsBtnText: {
        fontSize: 12,
        fontWeight: '800',
        color: NAVY
    },
    searchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 13,
        color: NAVY,
        fontWeight: '600'
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40
    },
    loadingText: {
        marginTop: 12,
        color: '#64748B',
        fontSize: 14,
        fontWeight: '600'
    },
    orderRow: {
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 16,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 1,
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4
    },
    orderIconCircle: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#FFFBEB',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        borderWidth: 1,
        borderColor: '#FDE68A'
    },
    orderCodeText: {
        fontWeight: '900',
        color: NAVY,
        fontSize: 14
    },
    statusPill: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6
    },
    statusPillText: {
        fontSize: 9,
        fontWeight: '900'
    },
    customerNameText: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2
    },
    amountText: {
        fontSize: 15,
        fontWeight: '900',
        color: NAVY
    },
    emptyBox: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        marginTop: 40,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    emptyIconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#FFFBEB',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#FDE68A'
    },
    emptyTitle: {
        fontSize: 17,
        fontWeight: '900',
        color: NAVY,
        marginBottom: 6
    },
    emptySub: {
        fontSize: 13,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 18
    },
    modalHeaderBar: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    modalHeaderTitle: {
        fontSize: 17,
        fontWeight: '900',
        color: NAVY
    },
    modalHeaderSub: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2
    },
    closeCircleBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center'
    },
    previewActionBar: {
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderColor: '#E2E8F0',
        padding: 16,
        flexDirection: 'row',
        gap: 12
    },
    shareBtn: {
        flex: 1,
        backgroundColor: '#F1F5F9',
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6
    },
    shareBtnText: {
        color: NAVY,
        fontWeight: '800',
        fontSize: 14
    },
    emailBtn: {
        flex: 2,
        backgroundColor: GOLD,
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        elevation: 2,
        shadowColor: GOLD,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6
    },
    emailBtnText: {
        color: NAVY,
        fontWeight: '900',
        fontSize: 14
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: '#475569',
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    settingsInput: {
        backgroundColor: '#FFFFFF',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        color: NAVY,
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 16
    },
    brandingSectionTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: NAVY,
        marginTop: 8,
        marginBottom: 10
    },
    assetBox: {
        flex: 1,
        height: 95,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
    },
    assetImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'contain'
    },
    assetLabel: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '700',
        marginTop: 4
    },
    saveSettingsBtn: {
        backgroundColor: GOLD,
        paddingVertical: 15,
        borderRadius: 16,
        marginTop: 20,
        alignItems: 'center',
        elevation: 2,
        shadowColor: GOLD,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6
    },
    saveSettingsBtnText: {
        color: NAVY,
        fontWeight: '900',
        fontSize: 15
    }
});
