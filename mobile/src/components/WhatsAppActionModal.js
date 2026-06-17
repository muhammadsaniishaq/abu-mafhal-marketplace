import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView,
    TextInput, ActivityIndicator, Alert, Linking, KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { whatsappService } from '../services/whatsappService';

const TEMPLATES = [
    {
        id: 'welcome',
        name: 'Welcome Message',
        text: 'Welcome to Abu Mafhal! Your account has been successfully created. We are excited to have you on board.',
        fields: []
    },
    {
        id: 'payment',
        name: 'Payment Confirmation',
        text: 'Thank you! We\'ve received your payment of ₦{amount} for order #{orderId}. We are processing it now.',
        fields: ['amount', 'orderId']
    },
    {
        id: 'order_update',
        name: 'Order Status Update',
        text: 'Your order #{orderId} status has been updated to: {status}. You can track your order in the app.',
        fields: ['orderId', 'status']
    },
    {
        id: 'support',
        name: 'Support Response',
        text: 'Hi! Regarding your query, support has replied: {message}. Let us know if you need anything else.',
        fields: ['message']
    }
];

function formatPhoneForAPI(phone) {
    if (!phone) return '';
    let clean = phone.replace(/\D/g, "");
    if (clean.startsWith("0") && clean.length === 11) {
        clean = "234" + clean.substring(1);
    } else if (clean.length === 10 && !clean.startsWith("234")) {
        clean = "234" + clean;
    }
    return clean;
}

export const WhatsAppActionModal = ({
    visible,
    phone,
    userId,
    recipientName = 'Customer',
    orderData = null,
    onClose
}) => {
    const [activeTab, setActiveTab] = useState('quick'); // 'quick', 'custom', 'history'
    const [customText, setCustomText] = useState('');
    const [sending, setSending] = useState(false);

    // Template state
    const [selectedTemplateId, setSelectedTemplateId] = useState('welcome');
    const [templateInputs, setTemplateInputs] = useState({});
    const [previewText, setPreviewText] = useState('');

    // History state
    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const formattedPhone = formatPhoneForAPI(phone);

    // Populate inputs initially based on orderData if available
    useEffect(() => {
        if (orderData) {
            setTemplateInputs({
                amount: orderData.total_amount?.toLocaleString() || '',
                orderId: orderData.id?.slice(0, 8).toUpperCase() || '',
                status: orderData.status?.toUpperCase() || ''
            });
        } else {
            setTemplateInputs({});
        }
    }, [orderData, visible]);

    // Update Preview Text when template or inputs change
    useEffect(() => {
        const tpl = TEMPLATES.find(t => t.id === selectedTemplateId);
        if (!tpl) return;
        let text = tpl.text;
        tpl.fields.forEach(field => {
            const val = templateInputs[field] || `[${field.toUpperCase()}]`;
            text = text.replace(`{${field}}`, val);
        });
        setPreviewText(text);
    }, [selectedTemplateId, templateInputs]);

    // Load history when tab is clicked or modal opens
    useEffect(() => {
        if (visible && activeTab === 'history') {
            fetchHistory();
        }
    }, [visible, activeTab, phone]);

    const fetchHistory = async () => {
        if (!phone) return;
        setLoadingHistory(true);
        try {
            const { data, error } = await supabase
                .from('whatsapp_messages')
                .select('*')
                .eq('phone', formattedPhone)
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) throw error;
            setHistory(data || []);
        } catch (e) {
            console.error('Error fetching WhatsApp history:', e);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleSendCustom = async () => {
        if (!customText.trim()) return Alert.alert('Error', 'Please write a message');
        if (!phone) return Alert.alert('Error', 'No recipient phone number');

        setSending(true);
        try {
            const res = await whatsappService.sendDirect(formattedPhone, customText.trim(), userId);
            if (res?.success) {
                Alert.alert('Success', 'WhatsApp message sent successfully!');
                setCustomText('');
                if (activeTab === 'history') fetchHistory();
                else setActiveTab('history');
            } else {
                throw new Error(res?.error || 'Message dispatch failed');
            }
        } catch (e) {
            Alert.alert('Send Failed', e.message || 'Verification or webhook issue.');
        } finally {
            setSending(false);
        }
    };

    const handleSendTemplate = async () => {
        if (!phone) return Alert.alert('Error', 'No recipient phone number');
        setSending(true);
        try {
            // Send template params
            const tpl = TEMPLATES.find(t => t.id === selectedTemplateId);
            const params = tpl.fields.map(f => templateInputs[f] || '');

            let res;
            if (selectedTemplateId === 'welcome') {
                res = await whatsappService.sendDirect(formattedPhone, previewText, userId);
            } else {
                res = await whatsappService.sendTemplate(formattedPhone, selectedTemplateId, params, userId);
            }

            if (res?.success) {
                Alert.alert('Success', 'WhatsApp template triggered successfully!');
                if (activeTab === 'history') fetchHistory();
                else setActiveTab('history');
            } else {
                throw new Error(res?.error || 'Failed to trigger template');
            }
        } catch (e) {
            Alert.alert('Template Failed', e.message || 'Error occurred during template invoke.');
        } finally {
            setSending(false);
        }
    };

    const handleLocalWhatsApp = () => {
        if (!phone) return;
        const msg = encodeURIComponent(activeTab === 'quick' ? previewText : customText);
        Linking.openURL(`whatsapp://send?phone=${formattedPhone}&text=${msg}`)
            .catch(() => Linking.openURL(`https://wa.me/${formattedPhone}?text=${msg}`).catch(() => Alert.alert('Error', 'WhatsApp app is not installed')));
    };

    const handleCall = () => {
        if (!phone) return;
        Linking.openURL(`tel:${phone}`);
    };

    if (!visible) return null;

    const tpl = TEMPLATES.find(t => t.id === selectedTemplateId);

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={styles.overlay}>
                    <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
                    <View style={styles.sheet}>
                        <View style={styles.dragBar} />

                        {/* Recipient Details */}
                        <View style={styles.header}>
                            <View>
                                <Text style={styles.recipientName}>{recipientName}</Text>
                                <Text style={styles.phoneText}>WhatsApp: +{formattedPhone}</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                <Ionicons name="close" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        {/* Tabs */}
                        <View style={styles.tabsRow}>
                            <TouchableOpacity
                                style={[styles.tabItem, activeTab === 'quick' && styles.tabItemActive]}
                                onPress={() => setActiveTab('quick')}
                            >
                                <Text style={[styles.tabText, activeTab === 'quick' && styles.tabTextActive]}>Quick Reply</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.tabItem, activeTab === 'custom' && styles.tabItemActive]}
                                onPress={() => setActiveTab('custom')}
                            >
                                <Text style={[styles.tabText, activeTab === 'custom' && styles.tabTextActive]}>Custom Msg</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.tabItem, activeTab === 'history' && styles.tabItemActive]}
                                onPress={() => setActiveTab('history')}
                            >
                                <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>Logs/History</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
                            {/* Tab Content: Quick Template */}
                            {activeTab === 'quick' && (
                                <View style={styles.tabContent}>
                                    <Text style={styles.sectionTitle}>Select Template</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                                        {TEMPLATES.map(t => (
                                            <TouchableOpacity
                                                key={t.id}
                                                style={[styles.templatePill, selectedTemplateId === t.id && styles.templatePillActive]}
                                                onPress={() => setSelectedTemplateId(t.id)}
                                            >
                                                <Text style={[styles.templatePillText, selectedTemplateId === t.id && styles.templatePillTextActive]}>
                                                    {t.name}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>

                                    {/* Parameters Inputs */}
                                    {tpl?.fields.length > 0 && (
                                        <View style={{ marginBottom: 16 }}>
                                            <Text style={styles.sectionSubTitle}>Inputs / Variables</Text>
                                            {tpl.fields.map(f => (
                                                <View key={f} style={styles.inputGroup}>
                                                    <Text style={styles.inputLabel}>{f.toUpperCase()}</Text>
                                                    <TextInput
                                                        style={styles.textInput}
                                                        value={templateInputs[f] || ''}
                                                        onChangeText={text => setTemplateInputs(prev => ({ ...prev, [f]: text }))}
                                                        placeholder={`Enter ${f}...`}
                                                        placeholderTextColor="#94A3B8"
                                                    />
                                                </View>
                                            ))}
                                        </View>
                                    )}

                                    {/* Preview */}
                                    <View style={styles.previewCard}>
                                        <Text style={styles.previewLabel}>MESSAGE PREVIEW</Text>
                                        <Text style={styles.previewText}>{previewText}</Text>
                                    </View>

                                    <TouchableOpacity
                                        style={styles.primaryBtn}
                                        onPress={handleSendTemplate}
                                        disabled={sending}
                                    >
                                        {sending ? <ActivityIndicator color="white" /> : (
                                            <>
                                                <Ionicons name="paper-plane" size={18} color="white" style={{ marginRight: 8 }} />
                                                <Text style={styles.primaryBtnText}>Send Template via API</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Tab Content: Custom Msg */}
                            {activeTab === 'custom' && (
                                <View style={styles.tabContent}>
                                    <Text style={styles.sectionTitle}>Custom Message</Text>
                                    <TextInput
                                        style={styles.messageBox}
                                        placeholder="Type your WhatsApp message..."
                                        placeholderTextColor="#94A3B8"
                                        multiline
                                        value={customText}
                                        onChangeText={setCustomText}
                                    />

                                    <TouchableOpacity
                                        style={styles.primaryBtn}
                                        onPress={handleSendCustom}
                                        disabled={sending}
                                    >
                                        {sending ? <ActivityIndicator color="white" /> : (
                                            <>
                                                <Ionicons name="paper-plane" size={18} color="white" style={{ marginRight: 8 }} />
                                                <Text style={styles.primaryBtnText}>Send Message via API</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Tab Content: Logs History */}
                            {activeTab === 'history' && (
                                <View style={styles.tabContent}>
                                    <Text style={styles.sectionTitle}>Communication History</Text>
                                    {loadingHistory ? (
                                        <ActivityIndicator color="#0F172A" style={{ marginTop: 20 }} />
                                    ) : history.length === 0 ? (
                                        <View style={styles.emptyLogs}>
                                            <Ionicons name="file-tray-outline" size={36} color="#CBD5E1" />
                                            <Text style={styles.emptyText}>No logs found for this phone.</Text>
                                        </View>
                                    ) : (
                                        history.map(item => (
                                            <View key={item.id} style={styles.logCard}>
                                                <Text style={styles.logMessage}>{item.message}</Text>
                                                <View style={styles.logMeta}>
                                                    <View style={[
                                                        styles.logStatus,
                                                        item.status === 'sent' ? styles.statusSent :
                                                        item.status === 'failed' ? styles.statusFailed : styles.statusPending
                                                    ]}>
                                                        <Text style={styles.statusText}>{item.status?.toUpperCase()}</Text>
                                                    </View>
                                                    <Text style={styles.logTime}>
                                                        {new Date(item.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                                    </Text>
                                                </View>
                                                {item.error_message && (
                                                    <Text style={styles.logError}>Err: {item.error_message}</Text>
                                                )}
                                            </View>
                                        ))
                                    )}
                                </View>
                            )}
                        </ScrollView>

                        {/* Direct Dial Fallbacks */}
                        <View style={styles.footer}>
                            <TouchableOpacity onPress={handleLocalWhatsApp} style={[styles.footerBtn, { backgroundColor: '#E2FBE9' }]}>
                                <Ionicons name="logo-whatsapp" size={18} color="#16A34A" />
                                <Text style={{ color: '#16A34A', fontSize: 13, fontWeight: '700', marginLeft: 6 }}>Open Chat App</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleCall} style={[styles.footerBtn, { backgroundColor: '#F1F5F9' }]}>
                                <Ionicons name="call" size={18} color="#475569" />
                                <Text style={{ color: '#475569', fontSize: 13, fontWeight: '700', marginLeft: 6 }}>Call Phone</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: 'white', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '85%', paddingBottom: Platform.OS === 'ios' ? 24 : 12 },
    dragBar: { width: 40, height: 5, backgroundColor: '#E2E8F0', borderRadius: 3, alignSelf: 'center', marginTop: 12 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, pb: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    recipientName: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
    phoneText: { fontSize: 12, color: '#64748B', marginTop: 2 },
    closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },
    tabsRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingHorizontal: 8 },
    tabItem: { flex: 1, paddingVertical: 14, alignItems: 'center', position: 'relative' },
    tabItemActive: { borderBottomWidth: 2, borderBottomColor: '#0F172A' },
    tabText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
    tabTextActive: { color: '#0F172A', fontWeight: '800' },
    body: { paddingHorizontal: 20, paddingTop: 16, maxHeight: 400 },
    tabContent: { paddingBottom: 24 },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 12 },
    sectionSubTitle: { fontSize: 12, fontWeight: '800', color: '#64748B', letterSpacing: 0.5, marginBottom: 8 },
    templatePill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9', marginRight: 8, borderWidth: 1, borderColor: '#E2E8F0' },
    templatePillActive: { backgroundColor: '#F0F9FF', borderColor: '#3B82F6' },
    templatePillText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
    templatePillTextActive: { color: '#3B82F6', fontWeight: '800' },
    inputGroup: { marginBottom: 12 },
    inputLabel: { fontSize: 11, fontWeight: '800', color: '#64748B', marginBottom: 4 },
    textInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 12, fontSize: 14, color: '#0F172A' },
    previewCard: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20 },
    previewLabel: { fontSize: 9, fontWeight: '900', color: '#94A3B8', letterSpacing: 1, marginBottom: 6 },
    previewText: { fontSize: 14, color: '#334155', lineHeight: 22 },
    primaryBtn: { backgroundColor: '#0F172A', padding: 16, borderRadius: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
    primaryBtnText: { color: 'white', fontWeight: '800', fontSize: 15 },
    messageBox: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 14, fontSize: 14, color: '#0F172A', height: 120, textAlignVertical: 'top', marginBottom: 20 },
    emptyLogs: { alignItems: 'center', padding: 30 },
    emptyText: { color: '#94A3B8', fontSize: 13, marginTop: 8 },
    logCard: { backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingVertical: 12 },
    logMessage: { fontSize: 14, color: '#1E293B', lineHeight: 20 },
    logMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
    logStatus: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    statusSent: { backgroundColor: '#DCFCE7' },
    statusFailed: { backgroundColor: '#FEE2E2' },
    statusPending: { backgroundColor: '#FEF3C7' },
    statusText: { fontSize: 8, fontWeight: '900', color: '#475569' },
    logTime: { fontSize: 11, color: '#94A3B8' },
    logError: { fontSize: 11, color: '#DC2626', marginTop: 4, fontStyle: 'italic' },
    footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
    footerBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }
});
