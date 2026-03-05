import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback,
    ScrollView, Modal, ActivityIndicator, KeyboardAvoidingView,
    Platform, Image, Animated, Easing, Clipboard, Alert, Dimensions, Share
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppSettings } from '../context/AppSettingsContext';
import { AIService } from '../services/aiService';
import { supabase } from '../lib/supabase';

const { width: SW } = Dimensions.get('window');

// ────────────────────────────────────────────
// Typing Dots
// ────────────────────────────────────────────
const TypingDots = () => {
    const dots = [0, 1, 2].map(() => useRef(new Animated.Value(0)).current);
    useEffect(() => {
        const anims = dots.map((d, i) =>
            Animated.loop(Animated.sequence([
                Animated.delay(i * 160),
                Animated.timing(d, { toValue: -8, duration: 270, easing: Easing.out(Easing.quad), useNativeDriver: true }),
                Animated.timing(d, { toValue: 0, duration: 270, easing: Easing.in(Easing.quad), useNativeDriver: true }),
                Animated.delay(520),
            ]))
        );
        anims.forEach(a => a.start());
        return () => anims.forEach(a => a.stop());
    }, []);
    return (
        <View style={{ flexDirection: 'row', gap: 5, paddingVertical: 5 }}>
            {dots.map((d, i) => <Animated.View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#94A3B8', transform: [{ translateY: d }] }} />)}
        </View>
    );
};

// ────────────────────────────────────────────
// Spring-animated bubble
// ────────────────────────────────────────────
const Bubble = ({ children }) => {
    const s = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.spring(s, { toValue: 1, tension: 65, friction: 8, useNativeDriver: true }).start();
    }, []);
    return (
        <Animated.View style={{
            opacity: s,
            transform: [
                { translateY: s.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
                { scale: s.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }
            ]
        }}>{children}</Animated.View>
    );
};

// ────────────────────────────────────────────
// Markdown renderer
// ────────────────────────────────────────────
const MD = ({ text = '', isUser, accent }) => {
    const base = isUser ? 'rgba(255,255,255,0.93)' : '#334155';
    const bold = isUser ? 'white' : '#0F172A';
    const renderLine = (raw) => raw.split(/\*\*(.*?)\*\*/g).map((seg, si) =>
        si % 2 === 1
            ? <Text key={si} style={{ fontWeight: '800', color: bold, fontSize: 13 }}>{seg}</Text>
            : <Text key={si} style={{ color: base, fontSize: 13, lineHeight: 20 }}>{seg}</Text>
    );
    return (
        <View>
            {text.split('\n').map((ln, i) => {
                const num = ln.match(/^(\d+)\.\s+(.+)/);
                const bul = ln.match(/^[-*•]\s+(.+)/);
                if (num) return (
                    <View key={i} style={{ flexDirection: 'row', gap: 7, marginBottom: 4, alignItems: 'flex-start' }}>
                        <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: isUser ? 'rgba(255,255,255,0.22)' : accent + '22', justifyContent: 'center', alignItems: 'center', marginTop: 1 }}>
                            <Text style={{ fontSize: 9, fontWeight: '900', color: isUser ? 'white' : accent }}>{num[1]}</Text>
                        </View>
                        <Text style={{ flex: 1, color: base, fontSize: 13, lineHeight: 20 }}>{num[2]}</Text>
                    </View>
                );
                if (bul) return (
                    <View key={i} style={{ flexDirection: 'row', gap: 7, marginBottom: 4, alignItems: 'flex-start' }}>
                        <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: isUser ? 'rgba(255,255,255,0.6)' : accent, marginTop: 7 }} />
                        <Text style={{ flex: 1, color: base, fontSize: 13, lineHeight: 20 }}>{bul[1]}</Text>
                    </View>
                );
                if (ln.trim() === '') return <View key={i} style={{ height: 4 }} />;
                return <Text key={i} style={{ fontSize: 13, lineHeight: 20, marginBottom: 1 }}>{renderLine(ln)}</Text>;
            })}
        </View>
    );
};

// ────────────────────────────────────────────
// Date Separator
// ────────────────────────────────────────────
const DateSep = ({ label }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 10, gap: 8 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: '#E2E8F0' }} />
        <View style={{ backgroundColor: '#E2E8F0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
            <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '700' }}>{label}</Text>
        </View>
        <View style={{ flex: 1, height: 1, backgroundColor: '#E2E8F0' }} />
    </View>
);

// ────────────────────────────────────────────
// Context Menu
// ────────────────────────────────────────────
const ContextMenu = ({ msg, visible, onClose, onCopy, onShare, onSpeak, onFeedback, speaking, accent }) => {
    if (!visible) return null;
    const actions = [
        { icon: 'copy-outline', label: 'Copy', cb: () => { onCopy(); onClose(); } },
        { icon: 'share-outline', label: 'Share', cb: () => { onShare(); onClose(); } },
        { icon: speaking ? 'volume-high' : 'volume-medium-outline', label: speaking ? 'Stop' : 'Read aloud', cb: () => { onSpeak(); onClose(); } },
        { icon: 'thumbs-up-outline', label: 'Helpful', cb: () => { onFeedback('up'); onClose(); } },
        { icon: 'thumbs-down-outline', label: 'Not helpful', cb: () => { onFeedback('down'); onClose(); } },
    ];
    return (
        <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}>
                    <TouchableWithoutFeedback>
                        <View style={{ backgroundColor: 'white', borderRadius: 20, padding: 8, minWidth: 220, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 }}>
                            <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '700', textAlign: 'center', letterSpacing: 0.8, paddingVertical: 8, textTransform: 'uppercase' }}>Message Options</Text>
                            {actions.map((a, i) => (
                                <TouchableOpacity key={i} onPress={a.cb}
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12, backgroundColor: i % 2 === 0 ? '#F8FAFC' : 'white' }}>
                                    <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: accent + '15', justifyContent: 'center', alignItems: 'center' }}>
                                        <Ionicons name={a.icon} size={17} color={accent} />
                                    </View>
                                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#1E293B' }}>{a.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

// ────────────────────────────────────────────
// Product Card
// ────────────────────────────────────────────
const ProductCard = ({ product, onNavigate }) => (
    <TouchableOpacity onPress={() => onNavigate?.('ProductDetails', { product })} activeOpacity={0.82}
        style={{ marginRight: 12, width: 148, backgroundColor: 'white', borderRadius: 18, overflow: 'hidden', shadowColor: '#4F46E5', shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 }}>
        <Image source={{ uri: product.images?.[0] || 'https://placehold.co/148' }} style={{ width: 148, height: 108 }} resizeMode="cover" />
        <View style={{ padding: 10 }}>
            <Text numberOfLines={2} style={{ fontSize: 12, fontWeight: '700', color: '#0F172A', lineHeight: 16 }}>{product.name}</Text>
            <Text style={{ fontSize: 14, fontWeight: '900', color: '#4F46E5', marginTop: 5 }}>₦{product.price?.toLocaleString()}</Text>
            {product.stock_quantity > 0 && product.stock_quantity < 5 &&
                <Text style={{ fontSize: 10, color: '#F59E0B', fontWeight: '700', marginTop: 3 }}>Only {product.stock_quantity} left!</Text>}
        </View>
    </TouchableOpacity>
);

// ────────────────────────────────────────────
// Suggestion chips row
// ────────────────────────────────────────────
const Suggestions = ({ chips, onTap, accent }) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, paddingLeft: 4 }}>
        {chips.map((c, i) => (
            <TouchableOpacity key={i} onPress={() => onTap(c)}
                style={{ backgroundColor: accent + '10', borderWidth: 1.5, borderColor: accent + '22', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16 }}>
                <Text style={{ fontSize: 12, color: accent, fontWeight: '700' }}>{c}</Text>
            </TouchableOpacity>
        ))}
    </View>
);

// ────────────────────────────────────────────
// CONSTANTS
// ────────────────────────────────────────────
const CHIPS_USER = ['Track my order 📦', 'My tickets 🎫', 'Payment help 💳', 'How to return? 🔄', 'Recommend products 🛍️'];
const MAX_CHARS = 500;
const SK = (r) => `ai_chat_v3_${r}`;
const fmtDate = (d) => { const diff = Math.floor((Date.now() - new Date(d)) / 86400000); return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : new Date(d).toLocaleDateString(); };

// ────────────────────────────────────────────
// MAIN COMPONENT  (USER ONLY — no admin data)
// ────────────────────────────────────────────
export const AIAssistantModal = ({ visible, onClose, user, onNavigate }) => {
    const insets = useSafeAreaInsets();
    const { settings } = useAppSettings();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [vSearching, setVSearching] = useState(false);
    const [provider, setProvider] = useState('gemini');
    const [pendingImg, setPendingImg] = useState(null);
    const [userCtx, setUserCtx] = useState('');
    const [ctxLoaded, setCtxLoaded] = useState(false);
    const [feedback, setFeedback] = useState({});
    const [speaking, setSpeaking] = useState(null);
    const [menu, setMenu] = useState(null);
    const [showDown, setShowDown] = useState(false);
    const scrollRef = useRef();

    // ⚠️ SECURITY: This modal is USER-ONLY.
    // It has no access to: revenue, all users, vendor list, admin stats.
    // Admin uses AdminAIAssistantModal exclusively.
    const role = 'user';
    const accent = '#4F46E5';
    const grad = ['#4F46E5', '#7C3AED'];
    const chips = CHIPS_USER;

    useEffect(() => {
        if (visible) { loadChat(); if (!ctxLoaded && user?.id) fetchCtx(); }
        return () => { Speech.stop(); setSpeaking(null); };
    }, [visible]);

    const loadChat = async () => {
        try { const s = await AsyncStorage.getItem(SK(role)); if (s) { const p = JSON.parse(s); if (p.length) { setMessages(p); return; } } } catch { }
        setMessages([{
            id: 'welcome', role: 'assistant', suggestions: chips.slice(0, 3), day: 'Today',
            content: '👋 **Sannu da zuwa!**\n\nI\'m your AI Shopping Assistant. I can:\n- Track & manage your orders\n- Find products by photo 📸\n- Help with payments & returns\n\nKa tambayi komai!'
        }]);
    };

    const saveChat = async (msgs) => { try { await AsyncStorage.setItem(SK(role), JSON.stringify(msgs.slice(-50))); } catch { } };

    const fetchCtx = async () => {
        try {
            const [{ data: ord }, { data: tick }] = await Promise.all([
                supabase.from('orders').select('id,status,total_amount,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
                supabase.from('support_tickets').select('subject,status,category').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
            ]);
            let c = `Customer: ${user.full_name || 'Valued Customer'}\n`;
            ord?.forEach(o => { c += `Order #${o.id?.slice(0, 8).toUpperCase()}: ${o.status} ₦${o.total_amount?.toLocaleString()} (${new Date(o.created_at).toLocaleDateString()})\n`; });
            tick?.forEach(t => { c += `Ticket: "${t.subject}" [${t.category}] ${t.status}\n`; });
            setUserCtx(c); setCtxLoaded(true);
        } catch (e) { console.log('ctx:', e); }
    };

    const searchProds = async ({ keywords = [], category = '', name = '', color = '' }) => {
        try {
            const terms = [name, ...keywords, color].filter(Boolean);
            let { data } = await supabase.from('products').select('id,name,price,images,stock_quantity,category')
                .or(terms.map(k => `name.ilike.%${k}%`).join(',')).eq('status', 'approved').gt('stock_quantity', 0).limit(8);
            if (!data?.length && category) {
                const { data: d2 } = await supabase.from('products').select('id,name,price,images,stock_quantity,category')
                    .ilike('category', `%${category}%`).eq('status', 'approved').gt('stock_quantity', 0).limit(8);
                data = d2 || [];
            }
            const seen = new Set();
            return (data || []).filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
        } catch { return []; }
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

    const handleSpeak = (msg) => {
        if (speaking === msg.id) { Speech.stop(); setSpeaking(null); return; }
        Speech.stop();
        const plain = msg.content.replace(/\*\*/g, '');
        Speech.speak(plain, { rate: 0.95, onStart: () => setSpeaking(msg.id), onDone: () => setSpeaking(null), onError: () => setSpeaking(null) });
    };

    const handleSend = async (override) => {
        const txt = (override || input).trim();
        if (!txt && !pendingImg) return;
        const hasImg = !!pendingImg;
        const userMsg = {
            id: Date.now().toString(), role: 'user',
            content: txt || '🔍 Search for this product',
            imageUri: pendingImg?.uri || null,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            day: 'Today',
        };
        const cur = [...messages, userMsg];
        setMessages(cur); setInput(''); const img = pendingImg; setPendingImg(null); setLoading(true);

        try {
            if (hasImg && role === 'user' && settings?.gemini_api_key) {
                setVSearching(true); setLoading(false);
                try {
                    const analyzed = await AIService.analyzeProductImage(img.base64, img.mimeType, settings.gemini_api_key);
                    setVSearching(false); setLoading(true);
                    const prods = await searchProds(analyzed);
                    const exact = prods.filter(p => analyzed.name && p.name.toLowerCase().includes(analyzed.name.toLowerCase().split(' ')[0]));
                    const similar = prods.filter(p => !exact.find(e => e.id === p.id));
                    const rm = {
                        id: (Date.now() + 1).toString(), role: 'assistant', type: 'product_search',
                        analyzed, exactMatches: exact, similarProducts: similar,
                        suggestions: ['Show similar items', 'What\'s the price range?', 'Any discounts available?'],
                        content: prods.length
                            ? `I found **${analyzed.name || 'this item'}** (${analyzed.color ? analyzed.color + ' ' : ''}${analyzed.category || ''}). Here are results from our store:`
                            : `I analyzed your image — it looks like **${analyzed.name || 'a product'}** (${analyzed.description || ''}). We don't carry this exact item right now.`,
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), day: 'Today',
                    };
                    const f = [...cur, rm]; setMessages(f); saveChat(f); return;
                } catch { setVSearching(false); setLoading(true); }
            }

            const history = messages.filter(m => (m.role === 'user' || m.role === 'assistant') && m.id !== 'welcome' && !m.type)
                .map(m => ({ role: m.role, content: m.content }));
            const { text, suggestions } = await AIService.generateResponse({
                prompt: txt, history, provider,
                geminiKey: settings?.gemini_api_key, openaiKey: settings?.openai_api_key,
                systemRole: role, imageBase64: img?.base64, imageMimeType: img?.mimeType, userContext: userCtx,
            });
            const aiMsg = { id: (Date.now() + 1).toString(), role: 'assistant', content: text, suggestions, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), day: 'Today' };
            const f = [...cur, aiMsg]; setMessages(f); saveChat(f);
        } catch (err) {
            const em = { id: (Date.now() + 1).toString(), role: 'assistant', content: `⚠️ ${err.message}`, suggestions: [], time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), day: 'Today' };
            const f = [...cur, em]; setMessages(f); saveChat(f);
        } finally { setLoading(false); }
    };

    // Insert date separators
    const enriched = [];
    let lastDay = null;
    messages.forEach((m) => {
        const day = m.day || 'Today';
        if (day !== lastDay) { enriched.push({ type: 'sep', day, id: `sep_${day}` }); lastDay = day; }
        enriched.push(m);
    });

    if (!visible) return null;

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            {/* Context menu overlay */}
            {menu && <ContextMenu msg={menu} visible={!!menu} accent={accent}
                onClose={() => setMenu(null)}
                onCopy={() => Clipboard.setString(menu.content)}
                onShare={() => Share.share({ message: menu.content.replace(/\*\*/g, '') })}
                onSpeak={() => handleSpeak(menu)}
                speaking={speaking === menu.id}
                onFeedback={(t) => setFeedback(p => ({ ...p, [menu.id]: p[menu.id] === t ? null : t }))} />}

            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: '#F0F4FA', borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '93%' }}>

                        {/* ── HEADER ── */}
                        <LinearGradient colors={grad} style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 20, borderTopLeftRadius: 32, borderTopRightRadius: 32 }}>
                            <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)', alignSelf: 'center', marginBottom: 16 }} />
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
                                    <View style={{ position: 'relative' }}>
                                        <LinearGradient colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.08)']} style={{ width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)' }}>
                                            <Text style={{ fontSize: 26 }}>✨</Text>
                                        </LinearGradient>
                                        <View style={{ position: 'absolute', bottom: 1, right: 1, width: 13, height: 13, borderRadius: 6.5, backgroundColor: '#10B981', borderWidth: 2, borderColor: grad[1] }} />
                                    </View>
                                    <View>
                                        <Text style={{ fontSize: 19, fontWeight: '900', color: 'white', letterSpacing: 0.1 }}>AI Assistant</Text>
                                        <Text style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.6)', fontWeight: '600', marginTop: 2 }}>
                                            {provider === 'gemini' ? '✦ Gemini' : '⬡ GPT-4o'} • {role === 'admin' ? 'Admin Mode' : 'User Mode'}
                                        </Text>
                                    </View>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <TouchableOpacity onPress={() => Alert.alert('🗑️ Clear Chat', 'Clear this entire conversation?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: async () => { await AsyncStorage.removeItem(SK(role)); setFeedback({}); setCtxLoaded(false); loadChat(); } }])} style={hBtn}>
                                        <Ionicons name="trash-outline" size={17} color="rgba(255,255,255,0.8)" />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={onClose} style={hBtn}>
                                        <Ionicons name="close" size={20} color="white" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Provider Toggle */}
                            <View style={{ flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 16, marginTop: 16, padding: 4 }}>
                                {[{ id: 'gemini', label: '✦ Google Gemini' }, { id: 'openai', label: '⬡ OpenAI GPT' }].map(p => (
                                    <TouchableOpacity key={p.id} onPress={() => setProvider(p.id)}
                                        style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12, backgroundColor: provider === p.id ? 'white' : 'transparent' }}>
                                        <Text style={{ fontSize: 13, fontWeight: '800', color: provider === p.id ? accent : 'rgba(255,255,255,0.75)' }}>{p.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </LinearGradient>

                        {/* ── MESSAGES ── */}
                        <View style={{ flex: 1 }}>
                            <ScrollView ref={scrollRef}
                                onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
                                onScroll={({ nativeEvent: { contentSize, contentOffset, layoutMeasurement } }) =>
                                    setShowDown(contentOffset.y + layoutMeasurement.height < contentSize.height - 60)}
                                scrollEventThrottle={200}
                                contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 16 }}
                                showsVerticalScrollIndicator={false}>

                                {/* Quick start chips */}
                                {messages.length <= 1 && (
                                    <View style={{ marginBottom: 18 }}>
                                        <Text style={{ fontSize: 10.5, color: '#94A3B8', fontWeight: '700', textAlign: 'center', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 }}>Quick Questions</Text>
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, justifyContent: 'center' }}>
                                            {chips.map(c => (
                                                <TouchableOpacity key={c} onPress={() => handleSend(c.replace(/[^\w\s?]/g, '').trim())}
                                                    style={{ backgroundColor: 'white', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: accent + '20', shadowColor: accent, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 }}>
                                                    <Text style={{ fontSize: 12.5, color: accent, fontWeight: '700' }}>{c}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                        {role === 'user' && (
                                            <LinearGradient colors={[accent + '10', accent + '05']} style={{ marginTop: 12, borderRadius: 18, padding: 13, flexDirection: 'row', gap: 11, alignItems: 'center', borderWidth: 1, borderColor: accent + '14' }}>
                                                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: accent + '18', justifyContent: 'center', alignItems: 'center' }}>
                                                    <Text style={{ fontSize: 20 }}>📸</Text>
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={{ fontWeight: '800', color: accent, fontSize: 12.5 }}>Visual Product Search</Text>
                                                    <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2, lineHeight: 17 }}>Tap 📷 and send a photo — I'll find matching products in our store!</Text>
                                                </View>
                                            </LinearGradient>
                                        )}
                                    </View>
                                )}

                                {/* Visual search badge */}
                                {vSearching && (
                                    <Bubble>
                                        <View style={{ backgroundColor: '#EDE9FE', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 9, alignSelf: 'flex-start', marginBottom: 12 }}>
                                            <ActivityIndicator size="small" color="#7C3AED" />
                                            <Text style={{ color: '#5B21B6', fontSize: 13, fontWeight: '700' }}>🔍 Analyzing image & searching store…</Text>
                                        </View>
                                    </Bubble>
                                )}

                                {enriched.map((item, idx) => {
                                    if (item.type === 'sep') return <DateSep key={item.id} label={item.day} />;
                                    const msg = item;
                                    const isUser = msg.role === 'user';
                                    const isLast = idx === enriched.length - 1;

                                    if (msg.type === 'product_search') {
                                        return (
                                            <Bubble key={msg.id}>
                                                <View style={{ alignItems: 'flex-start', marginBottom: 16 }}>
                                                    <View style={{ flexDirection: 'row', gap: 8, maxWidth: SW * 0.93 }}>
                                                        <View style={avS(false, accent)}><Text style={{ fontSize: 17 }}>✨</Text></View>
                                                        <View style={{ flex: 1 }}>
                                                            <TouchableOpacity activeOpacity={0.85} onLongPress={() => setMenu(msg)} delayLongPress={400}>
                                                                <View style={[bubS(false, accent), { padding: 14 }]}>
                                                                    <MD text={msg.content} isUser={false} accent={accent} />
                                                                    {msg.analyzed?.name && (
                                                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                                                                            {[msg.analyzed.color, msg.analyzed.category, msg.analyzed.name].filter(Boolean).map((t, i) => (
                                                                                <View key={i} style={{ backgroundColor: accent + '12', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 }}>
                                                                                    <Text style={{ fontSize: 11, color: accent, fontWeight: '800' }}>{t}</Text>
                                                                                </View>
                                                                            ))}
                                                                        </View>
                                                                    )}
                                                                    {msg.exactMatches?.length > 0 && (
                                                                        <View style={{ marginTop: 12 }}>
                                                                            <Text style={{ fontSize: 12, fontWeight: '800', color: '#10B981', marginBottom: 8 }}>✅ Found in our store</Text>
                                                                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                                                                {msg.exactMatches.map(p => <ProductCard key={p.id} product={p} onNavigate={onNavigate} />)}
                                                                            </ScrollView>
                                                                        </View>
                                                                    )}
                                                                    {msg.similarProducts?.length > 0 && (
                                                                        <View style={{ marginTop: 12 }}>
                                                                            <Text style={{ fontSize: 12, fontWeight: '800', color: '#F59E0B', marginBottom: 8 }}>🔄 Similar products</Text>
                                                                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                                                                {msg.similarProducts.map(p => <ProductCard key={p.id} product={p} onNavigate={onNavigate} />)}
                                                                            </ScrollView>
                                                                        </View>
                                                                    )}
                                                                </View>
                                                            </TouchableOpacity>
                                                            <MsgMeta msg={msg} isUser={false} speaking={speaking === msg.id} accent={accent} liked={feedback[msg.id] === 'up'} disliked={feedback[msg.id] === 'down'} onMenu={() => setMenu(msg)} />
                                                            {isLast && msg.suggestions?.length > 0 && <Suggestions chips={msg.suggestions} onTap={handleSend} accent={accent} />}
                                                        </View>
                                                    </View>
                                                </View>
                                            </Bubble>
                                        );
                                    }

                                    return (
                                        <Bubble key={msg.id}>
                                            <View style={{ alignItems: isUser ? 'flex-end' : 'flex-start', marginBottom: 14 }}>
                                                <View style={{ flexDirection: isUser ? 'row-reverse' : 'row', gap: 8, maxWidth: SW * 0.87 }}>
                                                    <View style={avS(isUser, accent)}>
                                                        {isUser ? <Ionicons name="person" size={15} color={accent} /> : <Text style={{ fontSize: 17 }}>✨</Text>}
                                                    </View>
                                                    <View>
                                                        <TouchableOpacity activeOpacity={0.85} onLongPress={() => setMenu(msg)} delayLongPress={400}>
                                                            {isUser ? (
                                                                <LinearGradient colors={[accent, accent + 'CC']} style={[bubS(true, accent), { padding: 13 }]}>
                                                                    {msg.imageUri && <Image source={{ uri: msg.imageUri }} style={{ width: 190, height: 135, borderRadius: 10, marginBottom: 8 }} resizeMode="cover" />}
                                                                    <MD text={msg.content} isUser accent={accent} />
                                                                </LinearGradient>
                                                            ) : (
                                                                <View style={[bubS(false, accent), { padding: 13 }]}>
                                                                    {msg.imageUri && <Image source={{ uri: msg.imageUri }} style={{ width: 190, height: 135, borderRadius: 10, marginBottom: 8 }} resizeMode="cover" />}
                                                                    <MD text={msg.content} isUser={false} accent={accent} />
                                                                </View>
                                                            )}
                                                        </TouchableOpacity>
                                                        <MsgMeta msg={msg} isUser={isUser} speaking={speaking === msg.id} accent={accent}
                                                            liked={feedback[msg.id] === 'up'} disliked={feedback[msg.id] === 'down'} onMenu={() => setMenu(msg)} />
                                                        {!isUser && isLast && msg.suggestions?.length > 0 && <Suggestions chips={msg.suggestions} onTap={handleSend} accent={accent} />}
                                                    </View>
                                                </View>
                                            </View>
                                        </Bubble>
                                    );
                                })}

                                {/* Typing dots */}
                                {loading && (
                                    <Bubble>
                                        <View style={{ alignItems: 'flex-start', marginBottom: 12 }}>
                                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                                <View style={avS(false, accent)}><Text style={{ fontSize: 17 }}>✨</Text></View>
                                                <View style={[bubS(false, accent), { paddingHorizontal: 16, paddingVertical: 13 }]}><TypingDots /></View>
                                            </View>
                                        </View>
                                    </Bubble>
                                )}
                            </ScrollView>

                            {/* Scroll-to-bottom FAB */}
                            {showDown && (
                                <TouchableOpacity onPress={() => scrollRef.current?.scrollToEnd({ animated: true })}
                                    style={{ position: 'absolute', bottom: 10, right: 14, width: 38, height: 38, borderRadius: 19, backgroundColor: accent, justifyContent: 'center', alignItems: 'center', shadowColor: accent, shadowOpacity: 0.45, shadowRadius: 10, elevation: 8 }}>
                                    <Ionicons name="chevron-down" size={20} color="white" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Pending Image */}
                        {pendingImg && (
                            <View style={{ marginHorizontal: 14, marginBottom: 6, alignSelf: 'flex-start' }}>
                                <Image source={{ uri: pendingImg.uri }} style={{ width: 76, height: 60, borderRadius: 12, borderWidth: 2.5, borderColor: accent }} resizeMode="cover" />
                                <View style={{ position: 'absolute', top: -8, left: -4, backgroundColor: accent, borderRadius: 7, paddingHorizontal: 6, paddingVertical: 2 }}>
                                    <Text style={{ color: 'white', fontSize: 8.5, fontWeight: '900' }}>📸 SEARCH</Text>
                                </View>
                                <TouchableOpacity onPress={() => setPendingImg(null)} style={{ position: 'absolute', top: -8, right: -8, backgroundColor: '#EF4444', borderRadius: 12, width: 22, height: 22, justifyContent: 'center', alignItems: 'center' }}>
                                    <Ionicons name="close" size={13} color="white" />
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* ── INPUT ── */}
                        <View style={{ paddingHorizontal: 12, paddingVertical: 10, paddingBottom: insets.bottom + 10, backgroundColor: 'white', borderTopWidth: 1, borderColor: '#E8EDF4', flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                            <TouchableOpacity onPress={showImgOptions}
                                style={{ width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: pendingImg ? accent : '#E2E8F0', backgroundColor: pendingImg ? accent + '12' : '#F8FAFC' }}>
                                <Ionicons name="camera-outline" size={21} color={pendingImg ? accent : '#64748B'} />
                            </TouchableOpacity>

                            <View style={{ flex: 1 }}>
                                <TextInput
                                    style={{ backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: input.length > MAX_CHARS * 0.8 ? '#F59E0B' : '#E2E8F0', borderRadius: 22, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontSize: 14, color: '#0F172A', maxHeight: 100, lineHeight: 21 }}
                                    placeholder="Ask anything or send a photo..."
                                    placeholderTextColor="#94A3B8"
                                    value={input}
                                    onChangeText={v => setInput(v.slice(0, MAX_CHARS))}
                                    multiline
                                />
                                {input.length > MAX_CHARS * 0.75 && (
                                    <Text style={{ fontSize: 10, color: input.length >= MAX_CHARS ? '#EF4444' : '#F59E0B', textAlign: 'right', paddingRight: 4, marginTop: 2, fontWeight: '700' }}>
                                        {input.length}/{MAX_CHARS}
                                    </Text>
                                )}
                            </View>

                            <TouchableOpacity onPress={() => handleSend()}
                                disabled={(!input.trim() && !pendingImg) || loading || vSearching}
                                style={{ width: 42, height: 42, borderRadius: 21, overflow: 'hidden' }}>
                                <LinearGradient colors={(input.trim() || pendingImg) && !loading ? grad : ['#E2E8F0', '#E2E8F0']}
                                    style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                    {loading ? <ActivityIndicator size="small" color={accent} /> : <Ionicons name="send" size={18} color={(input.trim() || pendingImg) ? 'white' : '#94A3B8'} style={{ marginLeft: 3 }} />}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
};

// ── Shared Styles ──
const hBtn = { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.13)', justifyContent: 'center', alignItems: 'center' };
const avS = (isUser, accent) => ({ width: 30, height: 30, borderRadius: 15, backgroundColor: isUser ? accent + '18' : '#E8EEF4', justifyContent: 'center', alignItems: 'center' });
const bubS = (isUser, accent) => ({
    borderRadius: 18, borderBottomLeftRadius: isUser ? 18 : 4, borderBottomRightRadius: isUser ? 4 : 18,
    ...(isUser ? {} : { backgroundColor: 'white' }),
    shadowColor: isUser ? accent : '#64748B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isUser ? 0.22 : 0.07, shadowRadius: 8, elevation: 3,
});

const MsgMeta = ({ msg, isUser, speaking, accent, liked, disliked, onMenu }) => (
    <View style={{ flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, marginTop: 4, paddingHorizontal: 3 }}>
        {msg.time && <Text style={{ fontSize: 10.5, color: '#94A3B8' }}>{msg.time}</Text>}
        {!isUser && (
            <TouchableOpacity onPress={onMenu}>
                <Ionicons name="ellipsis-horizontal" size={14} color="#94A3B8" />
            </TouchableOpacity>
        )}
        {!isUser && (
            <View style={{ flexDirection: 'row', gap: 5 }}>
                <Ionicons name={liked ? 'thumbs-up' : 'thumbs-up-outline'} size={13} color={liked ? '#10B981' : '#CBD5E1'} />
                <Ionicons name={disliked ? 'thumbs-down' : 'thumbs-down-outline'} size={13} color={disliked ? '#EF4444' : '#CBD5E1'} />
                {speaking && <Ionicons name="volume-high" size={13} color="#7C3AED" />}
            </View>
        )}
    </View>
);
