import React, { useState, useEffect } from 'react';
import { 
    View, Text, TouchableOpacity, TextInput, ActivityIndicator, 
    FlatList, ScrollView, Modal, StyleSheet, Dimensions, Platform, Image, RefreshControl 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { useAppSettings } from '../../context/AppSettingsContext';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

const NAVY = '#0E1A2E';
const DEEP_NAVY = '#1E293B';
const GOLD = '#D9A73A';

export const AdminBroadcast = () => {
    const { settings } = useAppSettings();
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [actionText, setActionText] = useState('');
    const [actionLink, setActionLink] = useState('');
    const [imageUrl, setImageUrl] = useState(null);
    const [imageBase64, setImageBase64] = useState(null);
    const [imageMimeType, setImageMimeType] = useState(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [sending, setSending] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [history, setHistory] = useState([]);
    const [target, setTarget] = useState('all'); // all, vendors, customers, drivers
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // Custom Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [modalConfig, setModalConfig] = useState({ title: '', message: '', type: 'info', onConfirm: null });

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .limit(20)
                .order('created_at', { ascending: false });

            if (data) {
                setHistory(data);
            }
        } catch (e) {
            console.warn('Error fetching broadcast history:', e);
        } finally {
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchHistory();
    };

    const showAlert = (title, message, type = 'info', onConfirm = null) => {
        setModalConfig({ title, message, type, onConfirm });
        setModalVisible(true);
    };

    const handleGenerateAI = async () => {
        const apiKey = settings?.gemini_api_key || process.env.EXPO_PUBLIC_GEMINI_API_KEY;

        if (!apiKey) {
            showAlert('Babu API Key', 'Sanya Gemini API Key a saitunan Admin Settings domin amfani da AI.', 'error');
            return;
        }

        if (!aiPrompt.trim()) {
            showAlert('Dakatar!', 'Da fatan za a rubuta dan takaitaccen bayanin abin da kake son sanarwa ga AI.', 'info');
            return;
        }

        setIsGenerating(true);
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

            const prompt = `Act as an expert communications manager for the 'Abu Mafhal Marketplace' app in Nigeria. 
            I need to send a push notification broadcast to our users targetted at: ${target}. 
            Based on this rough idea: "${aiPrompt}"
            ${imageBase64 ? "IMPORTANT: An image is attached. Make the text relevant to this product/announcement visual." : ""}
            
            Write an engaging, professional title and a concise, clear message body in clear English or Hausa depending on context.
            Format your response as a JSON object with two keys: "title" and "message". 
            Do NOT include markdown formatting or backticks around the JSON. Return ONLY the raw JSON object.`;

            let result;
            if (imageBase64) {
                result = await model.generateContent([
                    prompt,
                    { inlineData: { data: imageBase64, mimeType: imageMimeType || 'image/jpeg' } }
                ]);
            } else {
                result = await model.generateContent(prompt);
            }
            const responseText = result.response.text().trim().replace(/```json/g, '').replace(/```/g, '');

            const parsed = JSON.parse(responseText);

            if (parsed.title) setTitle(parsed.title);
            if (parsed.message) setMessage(parsed.message);

            setAiPrompt('');
            showAlert('Nasarar AI! ✨', 'Gemini AI ta rubuta sanarwar cikin nasara. Zaka iya dubawa da gyarawa kafin aika wa.', 'success');
        } catch (error) {
            console.error('Gemini error:', error);
            showAlert('Kuskuren AI', error.message || 'An gaza rubuta sanarwa ta AI a yanzu.', 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const handlePickImage = async () => {
        try {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
                showAlert('Izini', 'Ana bukatar izinin gallery don loda hoto.', 'info');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.8,
                base64: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                setImageBase64(asset.base64);
                setImageMimeType(asset.mimeType || 'image/jpeg');

                setUploadingImage(true);
                try {
                    const fileName = `broadcast_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
                    const fileData = decode(asset.base64);

                    let uploadRes = await supabase.storage.from('banners').upload(fileName, fileData, {
                        contentType: asset.mimeType || 'image/jpeg',
                        upsert: true
                    });

                    let bucket = 'banners';
                    if (uploadRes.error) {
                        uploadRes = await supabase.storage.from('products').upload(fileName, fileData, {
                            contentType: asset.mimeType || 'image/jpeg',
                            upsert: true
                        });
                        bucket = 'products';
                    }

                    if (uploadRes.error) throw uploadRes.error;

                    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
                    setImageUrl(publicUrlData.publicUrl);
                } catch (err) {
                    console.log('Upload error:', err);
                    showAlert('Kuskuren Loda Hoto', 'An gaza loda hoton a tsari. ' + err.message, 'error');
                } finally {
                    setUploadingImage(false);
                }
            }
        } catch (error) {
            console.log('Pick error:', error);
        }
    };

    const handleSend = async () => {
        if (!title.trim() || !message.trim()) {
            showAlert('Bayanai Basu Cika Ba', 'Da fatan za a rubuta Babban Take (Title) da Sakon Sanarwa (Message).', 'info');
            return;
        }

        showAlert(
            'Tabbatar Da Aika Sanarwa',
            `Shin da gaske kana son aika wannan sanarwar ga bangaren ${target.toUpperCase()}?`,
            'confirm',
            async () => {
                setModalVisible(false);
                setSending(true);

                try {
                    // 1. Fetch Target Users from profiles
                    let query = supabase.from('profiles').select('id, full_name');
                    if (target === 'vendors') query = query.eq('role', 'vendor');
                    else if (target === 'customers') query = query.eq('role', 'customer');
                    else if (target === 'drivers') query = query.eq('role', 'driver');

                    const { data: users, error } = await query;
                    if (error) throw new Error('An gaza binciko masu amfani: ' + error.message);
                    if (!users || users.length === 0) throw new Error(`Babu masu amfani a sashin '${target}'.`);

                    // 2. Prepare in-app Notifications with exact table schema (user_id, title, body, data, is_read)
                    const notifications = users.map(u => ({
                        user_id: u.id,
                        title: title.trim(),
                        body: message.trim(),
                        is_read: false,
                        data: {
                            type: 'broadcast',
                            image_url: imageUrl || null,
                            action_text: actionText || null,
                            action_link: actionLink || null,
                            target_segment: target
                        }
                    }));

                    // 3. Insert in Chunks of 100
                    const chunkSize = 100;
                    for (let i = 0; i < notifications.length; i += chunkSize) {
                        const notifChunk = notifications.slice(i, i + chunkSize);
                        const { error: notifError } = await supabase.from('notifications').insert(notifChunk);
                        if (notifError) console.error("Notif Error:", notifError);
                    }

                    showAlert('Nasarar Aikawa! 🎉', `An yi nasarar isar da sanarwar ga mutane ${users.length} a cikin manhaja.`, 'success');
                    setTitle('');
                    setMessage('');
                    setActionLink('');
                    setActionText('');
                    setImageUrl(null);
                    setImageBase64(null);
                    setImageMimeType(null);
                    fetchHistory();

                } catch (e) {
                    showAlert('Kuskure', e.message, 'error');
                } finally {
                    setSending(false);
                }
            }
        );
    };

    const CustomModal = () => (
        <Modal transparent visible={modalVisible} animationType="fade">
            <View style={s.modalOverlay}>
                <View style={s.modalCard}>
                    <View style={[s.modalIconBg, {
                        backgroundColor: modalConfig.type === 'error' ? '#FEF2F2' : modalConfig.type === 'success' ? '#ECFDF5' : '#FFFBEB'
                    }]}>
                        <Ionicons
                            name={modalConfig.type === 'error' ? 'alert-circle' : modalConfig.type === 'success' ? 'checkmark-circle' : modalConfig.type === 'confirm' ? 'paper-plane' : 'information-circle'}
                            size={32}
                            color={modalConfig.type === 'error' ? '#EF4444' : modalConfig.type === 'success' ? '#059669' : GOLD}
                        />
                    </View>
                    <Text style={s.modalTitle}>{modalConfig.title}</Text>
                    <Text style={s.modalMessage}>{modalConfig.message}</Text>

                    <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                        {modalConfig.type === 'confirm' && (
                            <TouchableOpacity 
                                style={s.modalCancelBtn} 
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={s.modalCancelText}>A'a (Cancel)</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[
                                s.modalConfirmBtn,
                                { backgroundColor: modalConfig.type === 'error' ? '#EF4444' : modalConfig.type === 'confirm' ? GOLD : NAVY }
                            ]}
                            onPress={() => {
                                if (modalConfig.onConfirm) modalConfig.onConfirm();
                                else setModalVisible(false);
                            }}
                        >
                            <Text style={[s.modalConfirmText, { color: modalConfig.type === 'confirm' ? NAVY : '#FFFFFF' }]}>
                                {modalConfig.type === 'confirm' ? 'Eh, Aika Yanzu' : 'Na Gane'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );

    return (
        <View style={s.container}>
            {/* Header */}
            <View style={s.header}>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="megaphone" size={22} color={GOLD} />
                        <Text style={s.headerTitle}>Sanarwar Gaggawa (Broadcast)</Text>
                    </View>
                    <Text style={s.headerSubtitle}>Aika saƙon faɗakarwa kai tsaye ga masu sayayya, direbobi da yan kasuwa</Text>
                </View>
            </View>

            <ScrollView 
                contentContainerStyle={{ padding: 16, paddingBottom: 80 }} 
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[GOLD, NAVY]} />}
            >
                {/* Compose Card */}
                <View style={s.composeCard}>
                    <Text style={s.label}>Bangaren Da Ake Sanarwa (Target Audience)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }}>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            {[
                                { id: 'all', label: 'Duka (Kowa)', icon: 'globe-outline' },
                                { id: 'customers', label: 'Masu Sayayya', icon: 'people-outline' },
                                { id: 'vendors', label: 'Yan Kasuwa', icon: 'storefront-outline' },
                                { id: 'drivers', label: 'Direbobi', icon: 'car-outline' }
                            ].map(t => (
                                <TouchableOpacity
                                    key={t.id}
                                    onPress={() => setTarget(t.id)}
                                    style={[s.targetChip, target === t.id && s.targetChipActive]}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons
                                        name={t.icon}
                                        size={16}
                                        color={target === t.id ? GOLD : '#64748B'}
                                    />
                                    <Text style={[s.targetChipText, target === t.id && s.targetChipTextActive]}>
                                        {t.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>

                    {/* Gemini AI Assist Box */}
                    <View style={s.aiBox}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <Ionicons name="sparkles" size={18} color={NAVY} />
                            <Text style={s.aiBoxTitle}>Mataimakin Gemini AI (AI Writer)</Text>
                        </View>
                        <TextInput
                            style={s.aiInput}
                            placeholder="Takaita abin da kake son sanarwa a nan (misali: Rangwamen sallah)..."
                            placeholderTextColor="#94A3B8"
                            value={aiPrompt}
                            onChangeText={setAiPrompt}
                        />
                        <TouchableOpacity
                            style={s.aiGenerateBtn}
                            onPress={handleGenerateAI}
                            disabled={isGenerating}
                            activeOpacity={0.85}
                        >
                            {isGenerating ? (
                                <ActivityIndicator color={NAVY} size="small" />
                            ) : (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Ionicons name="color-wand" size={16} color={NAVY} />
                                    <Text style={s.aiGenerateBtnText}>Rubuta Sanarwa Da AI</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Optional Image Upload */}
                    <Text style={s.label}>Hoton Sanarwa (Na Zabi)</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
                        <TouchableOpacity
                            style={s.imageBox}
                            onPress={handlePickImage}
                            disabled={uploadingImage}
                            activeOpacity={0.8}
                        >
                            {uploadingImage ? (
                                <ActivityIndicator color={GOLD} />
                            ) : imageUrl ? (
                                <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                            ) : (
                                <Ionicons name="image-outline" size={26} color="#94A3B8" />
                            )}
                        </TouchableOpacity>
                        <View style={{ flex: 1, marginLeft: 14 }}>
                            <Text style={{ fontSize: 12, color: '#64748B', lineHeight: 16 }}>
                                Sanya hoton talla ko na kaya domin sanarwar ta fi jan hankali.
                            </Text>
                            {imageUrl && (
                                <TouchableOpacity onPress={() => { setImageUrl(null); setImageBase64(null); setImageMimeType(null); }} style={{ marginTop: 6 }}>
                                    <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 12 }}>Cire Hoton</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    <Text style={s.label}>Babban Take (Title) *</Text>
                    <TextInput
                        style={s.textInput}
                        placeholder="Misali: Sabon Rangwame a Kasuwa"
                        placeholderTextColor="#94A3B8"
                        value={title}
                        onChangeText={setTitle}
                    />

                    <Text style={s.label}>Sakon Sanarwa (Message) *</Text>
                    <TextInput
                        style={[s.textInput, { height: 110, textAlignVertical: 'top' }]}
                        placeholder="Rubuta cikakken bayanin sanarwar a nan..."
                        placeholderTextColor="#94A3B8"
                        value={message}
                        onChangeText={setMessage}
                        multiline
                    />

                    <Text style={s.label}>Adireshin Shiga / Link (Na Zabi)</Text>
                    <TextInput
                        style={s.textInput}
                        placeholder="Misali: /shop/category ko https://abumafhal.com"
                        placeholderTextColor="#94A3B8"
                        keyboardType="url"
                        autoCapitalize="none"
                        value={actionLink}
                        onChangeText={setActionLink}
                    />

                    {actionLink.length > 0 && (
                        <>
                            <Text style={s.label}>Rubutun Maballi (Button Text)</Text>
                            <TextInput
                                style={s.textInput}
                                placeholder="Misali: Shiga Kasuwa Yanzu"
                                placeholderTextColor="#94A3B8"
                                value={actionText}
                                onChangeText={setActionText}
                            />
                        </>
                    )}

                    <TouchableOpacity
                        style={[s.sendBroadcastBtn, sending && { opacity: 0.6 }]}
                        onPress={handleSend}
                        disabled={sending}
                        activeOpacity={0.85}
                    >
                        {sending ? (
                            <ActivityIndicator color={NAVY} />
                        ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Ionicons name="send" size={18} color={NAVY} />
                                <Text style={s.sendBroadcastBtnText}>Aika Sanarwar Ga Jama'a</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                {/* History Section */}
                <View style={s.historyHeader}>
                    <Text style={s.historyTitle}>Sanarwar Da Aka Aika Kusan Yanzu</Text>
                    <Text style={s.historySub}>Tarihin sanarwar da aka riga aka fitar</Text>
                </View>

                {history.map((item, index) => (
                    <View key={item.id || index} style={s.historyCard}>
                        <View style={s.historyCardTop}>
                            <Text style={s.historyCardTitle} numberOfLines={1}>
                                {item.title || 'Sanarwa'}
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                                <View style={s.dateBadge}>
                                    <Text style={s.dateBadgeText}>
                                        {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Yanzu'}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={s.resendBtn}
                                    onPress={() => {
                                        setTitle(item.title || '');
                                        setMessage(item.body || item.message || '');
                                        if (item.data?.image_url) setImageUrl(item.data.image_url);
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="reload" size={12} color={NAVY} />
                                    <Text style={s.resendBtnText}>Sake Aikawa</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                        <Text style={s.historyCardBody} numberOfLines={2}>
                            {item.body || item.message || 'Babu bayani'}
                        </Text>
                        {item.data?.image_url ? (
                            <Image 
                                source={{ uri: item.data.image_url }} 
                                style={s.historyImage} 
                                resizeMode="cover" 
                            />
                        ) : null}
                    </View>
                ))}

                {history.length === 0 && (
                    <View style={s.emptyHistory}>
                        <Ionicons name="chatbubbles-outline" size={40} color="#CBD5E1" style={{ marginBottom: 10 }} />
                        <Text style={{ color: '#64748B', fontWeight: '600', fontSize: 13 }}>Babu tarihin sanarwar da aka aika a baya.</Text>
                    </View>
                )}
            </ScrollView>

            <CustomModal />
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
    composeCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 18,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 2,
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        marginBottom: 20
    },
    label: {
        fontSize: 12,
        color: '#475569',
        fontWeight: '800',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    targetChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 14,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    targetChipActive: {
        backgroundColor: NAVY,
        borderColor: NAVY
    },
    targetChipText: {
        color: '#64748B',
        fontWeight: '700',
        fontSize: 12
    },
    targetChipTextActive: {
        color: GOLD,
        fontWeight: '800'
    },
    aiBox: {
        backgroundColor: '#FFFBEB',
        borderRadius: 16,
        padding: 14,
        marginBottom: 18,
        borderWidth: 1,
        borderColor: '#FDE68A'
    },
    aiBoxTitle: {
        fontWeight: '800',
        color: NAVY,
        fontSize: 13
    },
    aiInput: {
        backgroundColor: '#FFFFFF',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FDE68A',
        marginBottom: 10,
        fontSize: 13,
        color: NAVY,
        fontWeight: '600'
    },
    aiGenerateBtn: {
        backgroundColor: GOLD,
        padding: 12,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center'
    },
    aiGenerateBtnText: {
        color: NAVY,
        fontWeight: '900',
        fontSize: 13
    },
    imageBox: {
        width: 76,
        height: 76,
        borderRadius: 16,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
    },
    textInput: {
        backgroundColor: '#F8FAFC',
        padding: 13,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 16,
        fontSize: 14,
        color: NAVY,
        fontWeight: '600'
    },
    sendBroadcastBtn: {
        backgroundColor: GOLD,
        paddingVertical: 15,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 6,
        elevation: 2,
        shadowColor: GOLD,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6
    },
    sendBroadcastBtnText: {
        color: NAVY,
        fontWeight: '900',
        fontSize: 15
    },
    historyHeader: {
        marginBottom: 12,
        marginLeft: 2
    },
    historyTitle: {
        fontWeight: '900',
        fontSize: 16,
        color: NAVY
    },
    historySub: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2
    },
    historyCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    historyCardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6
    },
    historyCardTitle: {
        fontWeight: '800',
        color: NAVY,
        fontSize: 14,
        flex: 1,
        paddingRight: 8
    },
    dateBadge: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8
    },
    dateBadgeText: {
        fontSize: 10,
        color: '#64748B',
        fontWeight: '700'
    },
    resendBtn: {
        backgroundColor: '#FFFBEB',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderWidth: 1,
        borderColor: '#FDE68A'
    },
    resendBtnText: {
        fontSize: 10,
        color: NAVY,
        fontWeight: '800'
    },
    historyCardBody: {
        fontSize: 13,
        color: '#475569',
        lineHeight: 18
    },
    historyImage: {
        width: '100%',
        height: 120,
        borderRadius: 10,
        marginTop: 10
    },
    emptyHistory: {
        alignItems: 'center',
        padding: 30,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(14, 26, 46, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    modalCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        width: '100%',
        maxWidth: 380,
        padding: 24,
        alignItems: 'center',
        elevation: 8,
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 12
    },
    modalIconBg: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: NAVY,
        marginBottom: 6,
        textAlign: 'center'
    },
    modalMessage: {
        fontSize: 13,
        color: '#64748B',
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 18
    },
    modalCancelBtn: {
        flex: 1,
        padding: 13,
        borderRadius: 14,
        backgroundColor: '#F1F5F9',
        alignItems: 'center'
    },
    modalCancelText: {
        color: '#475569',
        fontWeight: '700',
        fontSize: 14
    },
    modalConfirmBtn: {
        flex: 1,
        padding: 13,
        borderRadius: 14,
        alignItems: 'center'
    },
    modalConfirmText: {
        fontWeight: '800',
        fontSize: 14
    }
});
