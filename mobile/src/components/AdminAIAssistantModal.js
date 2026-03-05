/**
 * AdminAIAssistantModal.js
 * ─────────────────────────────────────────────────────────────
 * AI Assistant Modal EXCLUSIVELY for Admin role.
 * Uses adminAIService.js — fully separate from user AI.
 * Has FULL access to platform data. Distinct dark premium UI.
 * ─────────────────────────────────────────────────────────────
 */
import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback,
    ScrollView, Modal, ActivityIndicator, KeyboardAvoidingView,
    Platform, Animated, Easing, Clipboard, Alert, Dimensions, Share, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppSettings } from '../context/AppSettingsContext';
import { AdminAIService, fetchAdminPlatformContext } from '../services/adminAIService';

const { width: SW } = Dimensions.get('window');

// ── Theme ────────────────────────────────
const ACCENT = '#3B82F6';
const GRAD = ['#FFFFFF', '#F8FAFC'];
const BORDER = '#E2E8F0';
const TEXT_MAIN = '#0F172A';
const TEXT_MUTED = '#64748B';
const SK = 'admin_ai_chat_v2'; // Changed key to reset history for new UI
const MAX_CHARS = 600;

const CHIPS = [
    'Platform summary 📊',
    'Low stock products 📉',
    'Pending vendors ✅',
    'Write a broadcast 📢',
    'Open support tickets 🎫',
    'Revenue insights 💰',
    'Draft flash sale 🔥',
    'Customer retention tips 🔄',
];

// ── Typing Dots ───────────────────────────
const TypingDots = () => {
    const dots = [0, 1, 2].map(() => useRef(new Animated.Value(0)).current);
    useEffect(() => {
        const a = dots.map((d, i) => Animated.loop(Animated.sequence([
            Animated.delay(i * 160),
            Animated.timing(d, { toValue: -8, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(d, { toValue: 0, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true }),
            Animated.delay(520),
        ])));
        a.forEach(x => x.start()); return () => a.forEach(x => x.stop());
    }, []);
    return <View style={{ flexDirection: 'row', gap: 5, paddingVertical: 5 }}>{dots.map((d, i) => <Animated.View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#64748B', transform: [{ translateY: d }] }} />)}</View>;
};

// ── Animated bubble ───────────────────────
const Bubble = ({ children }) => {
    const s = useRef(new Animated.Value(0)).current;
    useEffect(() => { Animated.spring(s, { toValue: 1, tension: 65, friction: 8, useNativeDriver: true }).start(); }, []);
    return <Animated.View style={{ opacity: s, transform: [{ translateY: s.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }, { scale: s.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }}>{children}</Animated.View>;
};

// ── Markdown renderer ─────────────────────
const MD = ({ text = '', isUser }) => {
    const base = isUser ? 'rgba(255,255,255,0.95)' : TEXT_MAIN;
    const bold = isUser ? 'white' : '#000000';
    const renderLine = (raw) => raw.split(/\*\*(.*?)\*\*/g).map((seg, si) =>
        si % 2 === 1 ? <Text key={si} style={{ fontWeight: '800', color: bold, fontSize: 13 }}>{seg}</Text>
            : <Text key={si} style={{ color: base, fontSize: 13, lineHeight: 20 }}>{seg}</Text>
    );
    return (
        <View>{text.split('\n').map((ln, i) => {
            const num = ln.match(/^(\d+)\.\s+(.+)/);
            const bul = ln.match(/^[-*•]\s+(.+)/);
            if (num) return (
                <View key={i} style={{ flexDirection: 'row', gap: 7, marginBottom: 4, alignItems: 'flex-start' }}>
                    <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: ACCENT + '22', justifyContent: 'center', alignItems: 'center', marginTop: 1 }}>
                        <Text style={{ fontSize: 9, fontWeight: '900', color: ACCENT }}>{num[1]}</Text>
                    </View>
                    <Text style={{ flex: 1, color: base, fontSize: 13, lineHeight: 20 }}>{num[2]}</Text>
                </View>
            );
            if (bul) return (
                <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 4, alignItems: 'flex-start' }}>
                    <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: ACCENT, marginTop: 7 }} />
                    <Text style={{ flex: 1, color: base, fontSize: 13, lineHeight: 20 }}>{bul[1]}</Text>
                </View>
            );
            if (ln.trim() === '') return <View key={i} style={{ height: 4 }} />;
            return <Text key={i} style={{ fontSize: 13, lineHeight: 20, marginBottom: 1 }}>{renderLine(ln)}</Text>;
        })}</View>
    );
};

// ── Stat Card (shown in welcome) ──────────
const StatCards = ({ ctx }) => {
    if (!ctx?.stats) return null;
    const { stats, lowStock = [], openTickets = [], pendingVendors = [], pendingPayouts = [] } = ctx;
    const items = [
        { icon: 'people-outline', label: 'Users', value: stats.users || 0, color: '#3B82F6' },
        { icon: 'storefront-outline', label: 'Vendors', value: stats.vendors || 0, color: '#8B5CF6' },
        { icon: 'cash-outline', label: 'Revenue', value: `₦${((stats.revenue || 0) / 1000).toFixed(0)}k`, color: '#10B981' },
        { icon: 'cube-outline', label: 'Pending Orders', value: stats.pendingOrders || 0, color: '#F59E0B' },
        { icon: 'alert-circle-outline', label: 'Low Stock', value: lowStock.length, color: '#EF4444' },
        { icon: 'ticket-outline', label: 'Open Tickets', value: openTickets.length, color: '#06B6D4' },
        { icon: 'time-outline', label: 'Pending Vendors', value: pendingVendors.length, color: '#F97316' },
        { icon: 'wallet-outline', label: 'Pending Payouts', value: pendingPayouts.length, color: '#EC4899' },
    ];
    return (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {items.map((it, i) => (
                <View key={i} style={{ width: (SW - 48) / 2 - 4, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: BORDER, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 }}>
                    <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: it.color + '15', justifyContent: 'center', alignItems: 'center' }}>
                        <Ionicons name={it.icon} size={17} color={it.color} />
                    </View>
                    <View>
                        <Text style={{ fontSize: 17, fontWeight: '900', color: TEXT_MAIN }}>{it.value}</Text>
                        <Text style={{ fontSize: 10, color: TEXT_MUTED, fontWeight: '600', marginTop: 1 }}>{it.label}</Text>
                    </View>
                </View>
            ))}
        </View>
    );
};

// ── Context Menu ──────────────────────────
const CtxMenu = ({ visible, onClose, onCopy, onShare, onSpeak, onFeedback, speaking }) => {
    if (!visible) return null;
    const items = [
        { icon: 'copy-outline', label: 'Copy', cb: () => { onCopy(); onClose(); } },
        { icon: 'share-outline', label: 'Share', cb: () => { onShare(); onClose(); } },
        { icon: speaking ? 'volume-high' : 'volume-medium-outline', label: speaking ? 'Stop reading' : 'Read aloud', cb: () => { onSpeak(); onClose(); } },
        { icon: 'thumbs-up-outline', label: 'Helpful', cb: () => { onFeedback('up'); onClose(); } },
        { icon: 'thumbs-down-outline', label: 'Not helpful', cb: () => { onFeedback('down'); onClose(); } },
    ];
    return (
        <Modal transparent animationType="fade" visible onRequestClose={onClose}>
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}>
                    <TouchableWithoutFeedback><View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 8, minWidth: 230, borderWidth: 1, borderColor: BORDER, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, elevation: 15 }}>
                        <Text style={{ fontSize: 11, color: TEXT_MUTED, fontWeight: '700', textAlign: 'center', letterSpacing: 0.8, paddingVertical: 8, textTransform: 'uppercase' }}>Message Options</Text>
                        {items.map((a, i) => (
                            <TouchableOpacity key={i} onPress={a.cb} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, backgroundColor: i % 2 === 0 ? '#F8FAFC' : '#FFFFFF' }}>
                                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: ACCENT + '15', justifyContent: 'center', alignItems: 'center' }}>
                                    <Ionicons name={a.icon} size={16} color={ACCENT} />
                                </View>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: TEXT_MAIN }}>{a.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View></TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

// ── Suggestions Row ───────────────────────
const Sugg = ({ chips, onTap }) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, paddingLeft: 4 }}>
        {chips.map((c, i) => (
            <TouchableOpacity key={i} onPress={() => onTap(c)}
                style={{ backgroundColor: ACCENT + '15', borderWidth: 1.5, borderColor: ACCENT + '30', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16 }}>
                <Text style={{ fontSize: 12, color: ACCENT, fontWeight: '700' }}>{c}</Text>
            </TouchableOpacity>
        ))}
    </View>
);

// ── Date Separator ────────────────────────
const DateSep = ({ label }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 10, gap: 8 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: BORDER }} />
        <View style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 }}>
            <Text style={{ fontSize: 10.5, color: TEXT_MUTED, fontWeight: '700' }}>{label}</Text>
        </View>
        <View style={{ flex: 1, height: 1, backgroundColor: BORDER }} />
    </View>
);

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export const AdminAIAssistantModal = ({ visible, onClose, onNavigate, user }) => {
    const insets = useSafeAreaInsets();
    const { settings } = useAppSettings();
    const userAvatar = user?.user_metadata?.avatar_url || user?.avatar_url;
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [pendingImg, setPendingImg] = useState(null);
    const [loading, setLoading] = useState(false);
    const [ctxLoading, setCtxLoading] = useState(false);
    const [platformCtx, setPlatformCtx] = useState({});
    const [provider, setProvider] = useState('gemini');
    const [feedback, setFeedback] = useState({});
    const [speaking, setSpeaking] = useState(null);
    const [menu, setMenu] = useState(null);
    const [showDown, setShowDown] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [sessions, setSessions] = useState([]);
    const [activeSessionId, setActiveSessionId] = useState(null);
    const scrollRef = useRef();

    useEffect(() => {
        if (visible) { loadSessions(); loadPlatformCtx(); }
        return () => { Speech.stop(); setSpeaking(null); };
    }, [visible]);

    const loadPlatformCtx = async () => {
        setCtxLoading(true);
        try { const ctx = await fetchAdminPlatformContext(); setPlatformCtx(ctx); } catch { }
        setCtxLoading(false);
    };

    const loadSessions = async () => {
        try {
            const keys = await AsyncStorage.getAllKeys();
            const sessionKeys = keys.filter(k => k.startsWith(SK + '_s_'));
            if (sessionKeys.length === 0) {
                startNewSession();
                return;
            }
            const stores = await AsyncStorage.multiGet(sessionKeys);
            const sess = stores.map(([k, v]) => ({ id: k, data: JSON.parse(v) })).sort((a, b) => b.data.updatedAt - a.data.updatedAt);
            setSessions(sess);
            if (!activeSessionId) loadSession(sess[0].id, sess[0].data);
        } catch { startNewSession(); }
    };

    const startNewSession = () => {
        const id = SK + '_s_' + Date.now();
        setActiveSessionId(id);
        setMessages([{ id: 'welcome', role: 'assistant', day: 'Today', suggestions: CHIPS.slice(0, 3), content: '🤖 **Admin AI Ready**\n\nI have access to all your platform data. Ask me anything about:\n- Orders, Vendors, Users, Revenue\n- Support tickets, Disputes, Payouts\n- Content: broadcasts, banners, coupons\n\nOr tap a chip below to get started.' }]);
    };

    const loadSession = (id, data) => {
        setActiveSessionId(id);
        setMessages(data.messages);
        setShowHistory(false);
    };

    const saveSession = async (msgs) => {
        if (!activeSessionId) return;
        try {
            const title = msgs.find(m => m.role === 'user')?.content.slice(0, 30) || 'New Chat';
            const data = { title, updatedAt: Date.now(), messages: msgs.slice(-60) };
            await AsyncStorage.setItem(activeSessionId, JSON.stringify(data));
            loadSessions(); // reload to update sidebar titles
        } catch { }
    };

    const handleSpeak = (msg) => {
        if (speaking === msg.id) { Speech.stop(); setSpeaking(null); return; }
        Speech.stop();
        Speech.speak(msg.content.replace(/\*\*/g, ''), { rate: 0.95, onStart: () => setSpeaking(msg.id), onDone: () => setSpeaking(null), onError: () => setSpeaking(null) });
    };

    const showImgOptions = () => Alert.alert('📸 Add Image', 'Choose source', [
        { text: '📷 Camera', onPress: () => pickImg(true) },
        { text: '🖼️ Gallery', onPress: () => pickImg(false) },
        { text: 'Cancel', style: 'cancel' },
    ]);

    const pickImg = async (cam) => {
        const fn = cam ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
        const r = await fn({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.65, base64: true });
        if (!r.canceled && r.assets?.[0]) { const a = r.assets[0]; setPendingImg({ uri: a.uri, base64: a.base64, mimeType: a.uri.endsWith('.png') ? 'image/png' : 'image/jpeg' }); }
    };

    const handleSend = async (override) => {
        const txt = (override || input).trim();
        if (!txt && !pendingImg) return;
        const hasImg = !!pendingImg;
        const userMsg = {
            id: Date.now().toString(), role: 'user', content: txt || '🔍 Analyze this image',
            imageUri: pendingImg?.uri || null,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), day: 'Today'
        };
        const cur = [...messages, userMsg];
        setMessages(cur); setInput(''); const img = pendingImg; setPendingImg(null); setLoading(true);
        try {
            const history = messages.filter(m => m.role !== 'welcome' && !m.type).map(m => ({ role: m.role, content: m.content }));
            const { text, suggestions } = await AdminAIService.generateResponse({
                prompt: txt || '🔍 Analyze this image', history, provider,
                geminiKey: settings?.gemini_api_key, openaiKey: settings?.openai_api_key,
                platformContext: platformCtx,
                imageBase64: img?.base64, imageMimeType: img?.mimeType
            });
            const aiMsg = { id: (Date.now() + 1).toString(), role: 'assistant', content: text, suggestions, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), day: 'Today' };
            const f = [...cur, aiMsg]; setMessages(f); saveSession(f);
        } catch (err) {
            const em = { id: (Date.now() + 1).toString(), role: 'assistant', content: `⚠️ ${err.message}`, suggestions: [], time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), day: 'Today' };
            const f = [...cur, em]; setMessages(f); saveSession(f);
        } finally { setLoading(false); }
    };

    const handleClear = () => Alert.alert('Clear Chat', 'Clear this admin chat history?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: async () => { if (activeSessionId) await AsyncStorage.removeItem(activeSessionId); setFeedback({}); loadSessions(); startNewSession(); } }
    ]);

    const handleRefreshCtx = async () => { await loadPlatformCtx(); Alert.alert('✅ Refreshed', 'Platform data updated.'); };

    // Insert date separators
    const enriched = [];
    let lastDay = null;
    messages.forEach(m => {
        const d = m.day || 'Today';
        if (d !== lastDay) { enriched.push({ type: 'sep', day: d, id: `sep_${d}` }); lastDay = d; }
        enriched.push(m);
    });

    if (!visible) return null;

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            {menu && <CtxMenu visible={!!menu} onClose={() => setMenu(null)} speaking={speaking === menu.id}
                onCopy={() => Clipboard.setString(menu.content)} onShare={() => Share.share({ message: menu.content.replace(/\*\*/g, '') })}
                onSpeak={() => handleSpeak(menu)} onFeedback={t => setFeedback(p => ({ ...p, [menu.id]: p[menu.id] === t ? null : t }))} />}

            {/* History Drawer */}
            {showHistory && (
                <View style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 100, flexDirection: 'row' }}>
                    <TouchableWithoutFeedback onPress={() => setShowHistory(false)}>
                        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
                    </TouchableWithoutFeedback>
                    <View style={{ width: SW * 0.75, backgroundColor: '#FFFFFF', height: '100%', paddingVertical: insets.top + 20, shadowColor: '#000', shadowOffset: { width: -5, height: 0 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 20 }}>
                        <View style={{ paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={{ fontSize: 18, fontWeight: '800', color: TEXT_MAIN }}>Chat History</Text>
                            <TouchableOpacity onPress={() => setShowHistory(false)} style={hBtn}>
                                <Ionicons name="close" size={20} color={TEXT_MAIN} />
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity onPress={() => { startNewSession(); setShowHistory(false); }} style={{ marginHorizontal: 20, backgroundColor: ACCENT + '15', padding: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20, borderWidth: 1, borderColor: ACCENT + '30' }}>
                            <Ionicons name="add" size={18} color={ACCENT} />
                            <Text style={{ color: ACCENT, fontWeight: '700', fontSize: 14 }}>New Chat</Text>
                        </TouchableOpacity>
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                            {sessions.map((s) => (
                                <TouchableOpacity key={s.id} onPress={() => loadSession(s.id, s.data)}
                                    style={{ padding: 14, borderRadius: 12, backgroundColor: activeSessionId === s.id ? '#F8FAFC' : 'transparent', borderWidth: 1, borderColor: activeSessionId === s.id ? BORDER : 'transparent', marginBottom: 4 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                        <Ionicons name="chatbubble-outline" size={15} color={activeSessionId === s.id ? ACCENT : TEXT_MUTED} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 13.5, fontWeight: activeSessionId === s.id ? '700' : '500', color: activeSessionId === s.id ? TEXT_MAIN : '#334155' }} numberOfLines={1}>{s.data.title}</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            )}

            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '93%' }}>

                        {/* ── HEADER ── */}
                        <LinearGradient colors={GRAD} style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 20, borderTopLeftRadius: 32, borderTopRightRadius: 32, borderBottomWidth: 1, borderColor: BORDER }}>
                            <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 16 }} />
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
                                    <View style={{ position: 'relative' }}>
                                        <LinearGradient colors={[ACCENT + '22', ACCENT + '00']} style={{ width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: ACCENT + '33', overflow: 'hidden' }}>
                                            <Image source={require('../../assets/am_logo.png')} style={{ width: 48, height: 48, borderRadius: 24, resizeMode: 'contain' }} />
                                        </LinearGradient>
                                        <View style={{ position: 'absolute', bottom: 1, right: 1, width: 13, height: 13, borderRadius: 6.5, backgroundColor: ctxLoading ? '#F59E0B' : '#10B981', borderWidth: 2, borderColor: '#FFFFFF' }} />
                                    </View>
                                    <View>
                                        <Text style={{ fontSize: 19, fontWeight: '900', color: TEXT_MAIN, letterSpacing: 0.1 }}>Admin AI</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                            <Text style={{ fontSize: 11.5, color: TEXT_MUTED, fontWeight: '600' }}>
                                                {ctxLoading ? '⏳ Loading data…' : `✓ Data loaded • ${provider === 'gemini' ? '✦ Gemini' : '⬡ GPT-4o'}`}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 4 }}>
                                    <TouchableOpacity onPress={() => setShowHistory(true)} style={hBtn}>
                                        <Ionicons name="time-outline" size={18} color={TEXT_MAIN} />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={handleRefreshCtx} style={hBtn}>
                                        <Ionicons name="refresh-outline" size={17} color={TEXT_MUTED} />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={handleClear} style={hBtn}>
                                        <Ionicons name="trash-outline" size={17} color={TEXT_MUTED} />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={onClose} style={hBtn}>
                                        <Ionicons name="close" size={20} color={TEXT_MUTED} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Provider Toggle */}
                            <View style={{ flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 16, marginTop: 16, padding: 4 }}>
                                {[{ id: 'gemini', label: '✦ Google Gemini' }, { id: 'openai', label: '⬡ OpenAI GPT' }].map(p => (
                                    <TouchableOpacity key={p.id} onPress={() => setProvider(p.id)}
                                        style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12, backgroundColor: provider === p.id ? '#FFFFFF' : 'transparent', shadowColor: provider === p.id ? '#000' : 'transparent', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: provider === p.id ? 2 : 0 }}>
                                        <Text style={{ fontSize: 13, fontWeight: '800', color: provider === p.id ? ACCENT : TEXT_MUTED }}>{p.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </LinearGradient>

                        {/* ── MESSAGES ── */}
                        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
                            <ScrollView ref={scrollRef} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
                                onScroll={({ nativeEvent: { contentSize, contentOffset, layoutMeasurement } }) =>
                                    setShowDown(contentOffset.y + layoutMeasurement.height < contentSize.height - 60)}
                                scrollEventThrottle={200}
                                contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 16 }} showsVerticalScrollIndicator={false}>

                                {/* Chips on first open */}
                                {messages.length <= 1 && (
                                    <View style={{ marginBottom: 18 }}>
                                        {/* Live stats grid */}
                                        {!ctxLoading && platformCtx?.stats && <StatCards ctx={platformCtx} />}
                                        {ctxLoading && <View style={{ backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, borderWidth: 1, borderColor: BORDER }}>
                                            <ActivityIndicator size="small" color={ACCENT} />
                                            <Text style={{ color: TEXT_MUTED, fontSize: 13, fontWeight: '700' }}>Loading platform data…</Text>
                                        </View>}
                                        <Text style={{ fontSize: 10.5, color: TEXT_MUTED, fontWeight: '700', textAlign: 'center', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 }}>Quick Actions</Text>
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, justifyContent: 'center' }}>
                                            {CHIPS.map(c => (
                                                <TouchableOpacity key={c} onPress={() => handleSend(c.replace(/[^\w\s?]/g, '').trim())}
                                                    style={{ backgroundColor: '#FFFFFF', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: BORDER, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
                                                    <Text style={{ fontSize: 12.5, color: TEXT_MAIN, fontWeight: '700' }}>{c}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                )}

                                {/* Messages */}
                                {enriched.map((item, idx) => {
                                    if (item.type === 'sep') return <DateSep key={item.id} label={item.day} />;
                                    const msg = item;
                                    const isUser = msg.role === 'user';
                                    const isLast = idx === enriched.length - 1;
                                    return (
                                        <Bubble key={msg.id}>
                                            <View style={{ alignItems: isUser ? 'flex-end' : 'flex-start', marginBottom: 14 }}>
                                                <View style={{ flexDirection: isUser ? 'row-reverse' : 'row', gap: 8, maxWidth: SW * 0.87 }}>
                                                    <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: isUser ? ACCENT + '15' : '#FFFFFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: isUser ? ACCENT + '30' : BORDER, overflow: 'hidden' }}>
                                                        {isUser ? (userAvatar ? <Image source={{ uri: userAvatar }} style={{ width: '100%', height: '100%' }} /> : <Ionicons name="person" size={15} color={ACCENT} />) : <Image source={require('../../assets/am_logo.png')} style={{ width: 22, height: 22, resizeMode: 'contain' }} />}
                                                    </View>
                                                    <View>
                                                        <TouchableOpacity activeOpacity={0.85} onLongPress={() => setMenu(msg)} delayLongPress={400}>
                                                            {isUser ? (
                                                                <LinearGradient colors={[ACCENT, '#2563EB']} style={[bub(true), { padding: 13 }]}>
                                                                    {msg.imageUri && <Image source={{ uri: msg.imageUri }} style={{ width: 190, height: 135, borderRadius: 10, marginBottom: 8 }} resizeMode="cover" />}
                                                                    <MD text={msg.content} isUser />
                                                                </LinearGradient>
                                                            ) : (
                                                                <View style={[bub(false), { padding: 13 }]}>
                                                                    {msg.imageUri && <Image source={{ uri: msg.imageUri }} style={{ width: 190, height: 135, borderRadius: 10, marginBottom: 8 }} resizeMode="cover" />}
                                                                    <MD text={msg.content} isUser={false} />
                                                                </View>
                                                            )}
                                                        </TouchableOpacity>
                                                        {/* Meta */}
                                                        <View style={{ flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, marginTop: 4, paddingHorizontal: 3 }}>
                                                            {msg.time && <Text style={{ fontSize: 10.5, color: TEXT_MUTED }}>{msg.time}</Text>}
                                                            {!isUser && <TouchableOpacity onPress={() => setMenu(msg)}>
                                                                <Ionicons name="ellipsis-horizontal" size={14} color={TEXT_MUTED} />
                                                            </TouchableOpacity>}
                                                            {!isUser && feedback[msg.id] === 'up' && <Ionicons name="thumbs-up" size={13} color="#10B981" />}
                                                            {!isUser && feedback[msg.id] === 'down' && <Ionicons name="thumbs-down" size={13} color="#EF4444" />}
                                                            {speaking === msg.id && <Ionicons name="volume-high" size={13} color={ACCENT} />}
                                                        </View>
                                                        {/* Follow-up suggestions on last AI message */}
                                                        {!isUser && isLast && msg.suggestions?.length > 0 && <Sugg chips={msg.suggestions} onTap={handleSend} />}
                                                    </View>
                                                </View>
                                            </View>
                                        </Bubble>
                                    );
                                })}

                                {/* Typing */}
                                {loading && (
                                    <Bubble>
                                        <View style={{ alignItems: 'flex-start', marginBottom: 12 }}>
                                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                                <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: BORDER, overflow: 'hidden' }}>
                                                    <Image source={require('../../assets/am_logo.png')} style={{ width: 22, height: 22, resizeMode: 'contain' }} />
                                                </View>
                                                <View style={[bub(false), { paddingHorizontal: 16, paddingVertical: 12 }]}><TypingDots /></View>
                                            </View>
                                        </View>
                                    </Bubble>
                                )}
                            </ScrollView>

                            {/* Scroll FAB */}
                            {showDown && (
                                <TouchableOpacity onPress={() => scrollRef.current?.scrollToEnd({ animated: true })}
                                    style={{ position: 'absolute', bottom: 10, right: 14, width: 38, height: 38, borderRadius: 19, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center', shadowColor: ACCENT, shadowOpacity: 0.5, shadowRadius: 10, elevation: 8 }}>
                                    <Ionicons name="chevron-down" size={20} color="white" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Pending Image */}
                        {pendingImg && (
                            <View style={{ marginHorizontal: 14, marginBottom: 6, alignSelf: 'flex-start' }}>
                                <Image source={{ uri: pendingImg.uri }} style={{ width: 76, height: 60, borderRadius: 12, borderWidth: 2.5, borderColor: ACCENT }} resizeMode="cover" />
                                <View style={{ position: 'absolute', top: -8, left: -4, backgroundColor: ACCENT, borderRadius: 7, paddingHorizontal: 6, paddingVertical: 2 }}>
                                    <Text style={{ color: 'white', fontSize: 8.5, fontWeight: '900' }}>📸 IMAGE</Text>
                                </View>
                                <TouchableOpacity onPress={() => setPendingImg(null)} style={{ position: 'absolute', top: -8, right: -8, backgroundColor: '#EF4444', borderRadius: 12, width: 22, height: 22, justifyContent: 'center', alignItems: 'center' }}>
                                    <Ionicons name="close" size={13} color="white" />
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* ── INPUT ── */}
                        <View style={{ paddingHorizontal: 12, paddingVertical: 10, paddingBottom: insets.bottom + 10, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderColor: BORDER, flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                            <TouchableOpacity onPress={showImgOptions}
                                style={{ width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: pendingImg ? ACCENT : BORDER, backgroundColor: pendingImg ? ACCENT + '12' : '#F8FAFC' }}>
                                <Ionicons name="camera-outline" size={21} color={pendingImg ? ACCENT : TEXT_MUTED} />
                            </TouchableOpacity>

                            <View style={{ flex: 1 }}>
                                <TextInput
                                    style={{ backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: input.length > MAX_CHARS * 0.8 ? '#F59E0B' : BORDER, borderRadius: 22, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontSize: 14, color: TEXT_MAIN, maxHeight: 100, lineHeight: 21 }}
                                    placeholder="Ask anything or send a photo..."
                                    placeholderTextColor={TEXT_MUTED}
                                    value={input} onChangeText={v => setInput(v.slice(0, MAX_CHARS))} multiline
                                />
                                {input.length > MAX_CHARS * 0.75 && (
                                    <Text style={{ fontSize: 10, color: input.length >= MAX_CHARS ? '#EF4444' : '#F59E0B', textAlign: 'right', paddingRight: 4, marginTop: 2, fontWeight: '700' }}>{input.length}/{MAX_CHARS}</Text>
                                )}
                            </View>
                            <TouchableOpacity onPress={() => handleSend()} disabled={(!input.trim() && !pendingImg) || loading}
                                style={{ width: 42, height: 42, borderRadius: 21, overflow: 'hidden' }}>
                                <LinearGradient colors={(input.trim() || pendingImg) && !loading ? [ACCENT, '#2563EB'] : ['#E2E8F0', '#E2E8F0']}
                                    style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                    {loading ? <ActivityIndicator size="small" color={ACCENT} /> : <Ionicons name="send" size={18} color={(input.trim() || pendingImg) ? 'white' : '#94A3B8'} style={{ marginLeft: 3 }} />}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
};

// ── Styles ──
const hBtn = { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' };
const bub = (isUser) => ({
    borderRadius: 18, borderBottomLeftRadius: isUser ? 18 : 4, borderBottomRightRadius: isUser ? 4 : 18,
    ...(isUser ? {} : { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BORDER }),
    shadowColor: isUser ? ACCENT : '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: isUser ? 0.2 : 0.05, shadowRadius: 6, elevation: 2,
});
