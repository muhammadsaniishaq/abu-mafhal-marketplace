import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, FlatList,
    KeyboardAvoidingView, Platform, SafeAreaView, ActivityIndicator,
    Image, Modal, Alert, StyleSheet, StatusBar, Linking, Pressable
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

const BRAND = {
    navy: '#0A192F',
    navyMid: '#0E2340',
    gold: '#E5A93C',
    goldDark: '#A07820',
    emerald: '#10B981',
    emeraldLight: '#ECFDF5',
    sky: '#0284C7',
    skyLight: '#E0F2FE',
    slate: '#64748B',
    slateDark: '#0F172A',
    slateLight: '#F1F5F9',
    bg: '#F8FAFC',
    border: '#E2E8F0',
    danger: '#EF4444',
};

const fmtPrice = (n) => {
    const num = Number(n);
    if (!num) return '₦0';
    return `₦${num.toLocaleString()}`;
};

export const ChatScreen = ({ route, navigation }) => {
    const {
        productId,
        vendorId,
        vendorName,
        productImage,
        vendorAvatar,
        productName,
        productPrice,
        vendorRole
    } = route.params || {};

    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    const [targetId, setTargetId] = useState(vendorId);
    const [uploading, setUploading] = useState(false);
    const [zoomImg, setZoomImg] = useState(null);
    const [showOptionsModal, setShowOptionsModal] = useState(false);
    const [productsCache, setProductsCache] = useState({});

    const isSupport = vendorId === 'admin' || vendorId === 'admin_support' || vendorName?.toLowerCase()?.includes('support');

    const [targetProfile, setTargetProfile] = useState({
        full_name: isSupport ? 'Abu Mafhal Support' : (vendorName || 'Merchant'),
        avatar_url: vendorAvatar || null,
        role: isSupport ? 'Support Team' : (vendorRole || 'Verified Seller'),
        is_online: true,
        phone: '2349021486162',
        whatsapp: '2349021486162'
    });

    const flatListRef = useRef(null);

    useEffect(() => {
        initChat();
    }, []);

    const initChat = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                Alert.alert('Authentication Required', 'Please login to start messaging.');
                navigation.goBack();
                return;
            }
            setCurrentUser(user);

            // Resolve target UUID if passed as 'admin' or string
            let resolvedId = targetId;
            if (!resolvedId || resolvedId === 'admin' || resolvedId === 'official') {
                const { data: adminProf } = await supabase
                    .from('profiles')
                    .select('id, full_name, business_name, avatar_url, role, phone')
                    .eq('role', 'admin')
                    .limit(1)
                    .maybeSingle();

                if (adminProf?.id) {
                    resolvedId = adminProf.id;
                    setTargetId(adminProf.id);
                    setTargetProfile(prev => ({
                        ...prev,
                        full_name: adminProf.business_name || adminProf.full_name || 'Abu Mafhal Support',
                        avatar_url: adminProf.avatar_url || prev.avatar_url,
                        role: 'Support Team',
                        phone: adminProf.phone || prev.phone
                    }));
                }
            } else {
                fetchTargetProfile(resolvedId);
            }

            if (resolvedId && resolvedId !== 'admin') {
                fetchMessages(user.id, resolvedId);
                const unsubMessages = subscribeToMessages(user.id, resolvedId);
                return () => {
                    unsubMessages && unsubMessages();
                };
            }
        } catch (err) {
            console.log('initChat error:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchTargetProfile = async (id) => {
        try {
            const [profileRes, storeRes] = await Promise.all([
                supabase.from('profiles').select('id, full_name, business_name, avatar_url, role, phone, is_online, address').eq('id', id).maybeSingle(),
                supabase.from('stores').select('name, logo, phone, whatsapp').eq('user_id', id).maybeSingle()
            ]);

            const data = profileRes?.data;
            const store = storeRes?.data;

            if (data || store) {
                let wa = store?.whatsapp || data?.phone;
                try {
                    if (data?.address && typeof data.address === 'string' && data.address.startsWith('{')) {
                        const parsed = JSON.parse(data.address);
                        if (parsed.whatsapp) wa = parsed.whatsapp;
                    }
                } catch (_) {}

                setTargetProfile(prev => ({
                    ...prev,
                    full_name: store?.name || data?.business_name || data?.full_name || prev.full_name,
                    avatar_url: store?.logo || data?.avatar_url || prev.avatar_url,
                    role: data?.role === 'admin' ? 'Support Team' : 'Verified Seller',
                    is_online: data?.is_online !== undefined ? data.is_online : true,
                    phone: store?.phone || data?.phone || prev.phone,
                    whatsapp: wa || prev.whatsapp
                }));
            }
        } catch (e) {
            console.log('fetchTargetProfile error:', e);
        }
    };

    const fetchProductInfo = async (pId) => {
        if (!pId || productsCache[pId]) return;
        try {
            const { data } = await supabase.from('products').select('id, name, price, image_url').eq('id', pId).single();
            if (data) {
                setProductsCache(prev => ({ ...prev, [pId]: data }));
            }
        } catch (e) {
            console.log('Error fetching product for chat context:', e);
        }
    };

    const fetchMessages = async (myId, otherId) => {
        try {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .or(`and(sender_id.eq.${myId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${myId})`)
                .order('created_at', { ascending: true });

            if (!error && data) {
                setMessages(data);
                setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 200);
            }
        } catch (err) {
            console.log('fetchMessages error:', err);
        } finally {
            setLoading(false);
        }
    };

    const subscribeToMessages = (myId, otherId) => {
        const channel = supabase
            .channel(`live_chat_${myId}_${otherId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages' },
                (payload) => {
                    const newMsg = payload.new;
                    if (
                        (newMsg.sender_id === myId && newMsg.receiver_id === otherId) ||
                        (newMsg.sender_id === otherId && newMsg.receiver_id === myId)
                    ) {
                        setMessages((prev) => {
                            // Avoid duplicate if already optimistically added
                            if (prev.some(m => m.id === newMsg.id)) return prev;
                            return [...prev, newMsg];
                        });
                        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
                    }
                }
            )
            .subscribe();

        return () => supabase.removeChannel(channel);
    };

    const pickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.7,
                base64: true,
            });

            if (!result.canceled && result.assets && result.assets[0]) {
                uploadAndSendImage(result.assets[0]);
            }
        } catch (err) {
            console.log('pickImage error:', err);
        }
    };

    const uploadAndSendImage = async (asset) => {
        try {
            setUploading(true);
            const base64 = asset.base64;
            const fileName = `chat_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
            const filePath = `${fileName}`;
            const BUCKET = 'chat-images';

            const { data, error } = await supabase.storage
                .from(BUCKET)
                .upload(filePath, decode(base64), {
                    contentType: 'image/jpeg',
                });

            let finalUrl = asset.uri;
            if (!error) {
                const { data: { publicUrl } } = supabase.storage
                    .from(BUCKET)
                    .getPublicUrl(filePath);
                finalUrl = publicUrl;
            }

            await sendMessage('image', finalUrl);
        } catch (error) {
            console.log('Upload image fallback:', error);
            // Even if bucket upload fails, send image as local/base64 preview
            await sendMessage('image', asset.uri);
        } finally {
            setUploading(false);
        }
    };

    const sendMessage = async (type = 'text', content = null) => {
        const textToSend = type === 'text' ? (content || inputText).trim() : '📷 Photo Attachment';
        const mediaUrl = type === 'image' ? content : null;

        if (!textToSend && !mediaUrl) return;

        let activeTargetId = targetId;
        if (!activeTargetId || activeTargetId === 'admin') {
            const { data: adminProf } = await supabase
                .from('profiles')
                .select('id')
                .eq('role', 'admin')
                .limit(1)
                .maybeSingle();

            if (adminProf?.id) {
                activeTargetId = adminProf.id;
                setTargetId(adminProf.id);
            } else {
                Alert.alert('Unable to Connect', 'Seller / Support profile is temporarily unreachable.');
                return;
            }
        }

        if (type === 'text') setInputText('');

        const tempId = `temp_${Date.now()}`;
        const optimisticMsg = {
            id: tempId,
            sender_id: currentUser.id,
            receiver_id: activeTargetId,
            message: textToSend,
            media_url: mediaUrl,
            message_type: type,
            created_at: new Date().toISOString(),
        };

        // Optimistic UI update
        setMessages((prev) => [...prev, optimisticMsg]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);

        try {
            const payload = {
                sender_id: currentUser.id,
                receiver_id: activeTargetId,
                message: textToSend,
                media_url: mediaUrl,
                message_type: type,
                created_at: new Date().toISOString()
            };

            const { data, error } = await supabase.from('messages').insert(payload).select().single();
            if (error) {
                console.error("Insert error:", error);
            } else if (data) {
                // Replace temp ID with real DB record
                setMessages(prev => prev.map(m => m.id === tempId ? data : m));
            }
        } catch (err) {
            console.log("Send message error:", err);
        }
    };

    const handleDirectWhatsApp = () => {
        const raw = targetProfile.whatsapp || targetProfile.phone || '2349021486162';
        const phone = raw.replace(/[^0-9]/g, '');
        const pContext = productName ? ` about "${productName}" (${fmtPrice(productPrice)})` : '';
        const msg = encodeURIComponent(`Hello ${targetProfile.full_name}, I am chatting with you from Abu Mafhal Marketplace${pContext}.`);
        Linking.openURL(`https://wa.me/${phone}?text=${msg}`).catch(() => {
            Alert.alert('WhatsApp Call', `Phone number: +${phone}`);
        });
    };

    const quickReplies = [
        "Is this item still available?",
        "Can you deliver to my city today?",
        "What is the warranty policy?",
        "Can I get a discount for bulk order?"
    ];

    const renderMessage = ({ item }) => {
        const isMe = item.sender_id === currentUser?.id;
        const timeStr = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Is this a product inquiry message?
        const isProductInquiry = item.product_id || (item.message && item.message.includes('[Product Inquiry:'));
        const embeddedProduct = item.product_id ? productsCache[item.product_id] : null;

        useEffect(() => {
            if (item.product_id && !productsCache[item.product_id]) {
                fetchProductInfo(item.product_id);
            }
        }, [item.product_id]);

        return (
            <View style={[s.msgWrapper, isMe ? s.msgWrapperMe : s.msgWrapperThem]}>
                {!isMe && (
                    <Image
                        source={{ uri: targetProfile.avatar_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=200&auto=format&fit=crop' }}
                        style={s.themAvatar}
                    />
                )}

                <View style={{ maxWidth: '78%' }}>
                    <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleThem]}>
                        
                        {/* PRODUCT CONTEXT EMBED */}
                        {isProductInquiry && embeddedProduct && (
                            <TouchableOpacity 
                                style={s.embeddedProductCard} 
                                activeOpacity={0.8}
                                onPress={() => navigation.navigate('ProductDetails', { id: embeddedProduct.id, product: embeddedProduct })}
                            >
                                <Image source={{ uri: embeddedProduct.image_url || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=300' }} style={s.embedImg} />
                                <View style={s.embedInfo}>
                                    <Text numberOfLines={1} style={s.embedTitle}>{embeddedProduct.name}</Text>
                                    <Text style={s.embedPrice}>{fmtPrice(embeddedProduct.price)}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={16} color={BRAND.navy} />
                            </TouchableOpacity>
                        )}

                        {item.message_type === 'image' || item.media_url ? (
                            <TouchableOpacity onPress={() => setZoomImg(item.media_url || item.message)} activeOpacity={0.9}>
                                <Image
                                    source={{ uri: item.media_url || item.message }}
                                    style={s.bubbleImage}
                                    resizeMode="cover"
                                />
                            </TouchableOpacity>
                        ) : (
                            <Text style={[s.msgText, isMe ? s.msgTextMe : s.msgTextThem]}>
                                {item.message?.replace(/\[Product Inquiry:.*?\]\n?/, '')}
                            </Text>
                        )}
                    </View>

                    {/* Timestamp & Receipt */}
                    <View style={[s.timeRow, isMe && { alignSelf: 'flex-end' }]}>
                        <Text style={s.timeTxt}>{timeStr}</Text>
                        {isMe && (
                            <Ionicons name="checkmark-done" size={13} color={BRAND.sky} style={{ marginLeft: 3 }} />
                        )}
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={s.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor={BRAND.navy} />

            {/* ══════════════════════════════════════════════════
                1. LUXURY MOBILE-FIRST CHAT HEADER
            ══════════════════════════════════════════════════ */}
            <View style={s.topHeader}>
                <TouchableOpacity
                    style={s.backBtn}
                    onPress={() => navigation.goBack()}
                    activeOpacity={0.7}
                >
                    <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
                </TouchableOpacity>

                {/* Partner Avatar & Presence */}
                <View style={s.partnerBox}>
                    <View style={s.avatarWrap}>
                        <Image
                            source={{ uri: targetProfile.avatar_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=200&auto=format&fit=crop' }}
                            style={s.avatarImg}
                        />
                        <View style={[s.statusDot, !targetProfile.is_online && { backgroundColor: '#94A3B8' }]} />
                    </View>

                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Text numberOfLines={1} style={s.partnerNameTxt}>
                                {targetProfile.full_name}
                            </Text>
                            <Ionicons name="checkmark-circle" size={14} color={BRAND.sky} />
                        </View>
                        <Text style={s.partnerStatusTxt}>
                            {targetProfile.is_online ? '● Online Now • Verified Escrow' : 'Offline • Tap for WhatsApp'}
                        </Text>
                    </View>
                </View>

                {/* Right Direct Actions */}
                <View style={s.headerActionsRow}>
                    {/* Direct WhatsApp Channel */}
                    <TouchableOpacity
                        style={s.headerWhatsAppBtn}
                        onPress={handleDirectWhatsApp}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
                    </TouchableOpacity>

                    {/* Options Menu */}
                    <TouchableOpacity
                        style={s.headerMoreBtn}
                        onPress={() => setShowOptionsModal(true)}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="ellipsis-vertical" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* ══════════════════════════════════════════════════
                2. INTERACTIVE PRODUCT ATTACHMENT CARD
            ══════════════════════════════════════════════════ */}
            {(productName || productImage) && (
                <View style={s.productBar}>
                    {productImage && (
                        <Image
                            source={{ uri: typeof productImage === 'string' && productImage.startsWith('http') ? productImage : 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=300' }}
                            style={s.productImg}
                        />
                    )}
                    <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={s.inquiryLabel}>Inquiry Regarding Product:</Text>
                        <Text numberOfLines={1} style={s.productTitleTxt}>{productName || 'Special Item'}</Text>
                        {productPrice && (
                            <Text style={s.productPriceTxt}>{fmtPrice(productPrice)}</Text>
                        )}
                    </View>

                    {/* Direct Buy/View Action */}
                    <TouchableOpacity
                        style={s.productActionBtn}
                        onPress={() => {
                            if (productId) {
                                navigation.navigate('ProductDetails', { id: productId, product: { id: productId, name: productName, price: productPrice, image_url: productImage } });
                            } else {
                                navigation.navigate('Main', { screen: 'shop' });
                            }
                        }}
                    >
                        <Text style={s.productActionBtnTxt}>View Item</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* ══════════════════════════════════════════════════
                3. REAL-TIME MESSAGES FEED
            ══════════════════════════════════════════════════ */}
            {loading ? (
                <View style={s.loadingBox}>
                    <ActivityIndicator size="large" color={BRAND.navy} />
                    <Text style={s.loadingTxt}>Opening encrypted live chat...</Text>
                </View>
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={(item, i) => item.id ? item.id.toString() : i.toString()}
                    renderItem={renderMessage}
                    contentContainerStyle={s.listContent}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    ListEmptyComponent={
                        <View style={s.emptyChatBox}>
                            <View style={s.emptyIconWrap}>
                                <Ionicons name="chatbubble-ellipses-outline" size={40} color={BRAND.gold} />
                            </View>
                            <Text style={s.emptyChatTitle}>Start Your Conversation</Text>
                            <Text style={s.emptyChatSub}>
                                Direct live chat with {targetProfile.full_name}. Inquiries are protected by Abu Mafhal Escrow Security.
                            </Text>
                        </View>
                    }
                />
            )}

            {/* ══════════════════════════════════════════════════
                4. INTERACTIVE QUICK CHIPS & INPUT COMPOSER
            ══════════════════════════════════════════════════ */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                {/* Floating Suggestion Chips */}
                <View style={s.chipsStrip}>
                    <FlatList
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        data={quickReplies}
                        keyExtractor={(item, idx) => 'chip-' + idx}
                        contentContainerStyle={{ paddingHorizontal: 12, gap: 6 }}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={s.quickChipPill}
                                onPress={() => sendMessage('text', item)}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="flash-outline" size={11} color={BRAND.navy} style={{ marginRight: 3 }} />
                                <Text style={s.quickChipTxt}>{item}</Text>
                            </TouchableOpacity>
                        )}
                    />
                </View>

                {/* Input Bar */}
                <View style={s.inputContainer}>
                    {/* Image Attachment Button */}
                    <TouchableOpacity
                        style={s.attachBtn}
                        onPress={pickImage}
                        activeOpacity={0.7}
                    >
                        {uploading ? (
                            <ActivityIndicator size="small" color={BRAND.navy} />
                        ) : (
                            <Ionicons name="camera-outline" size={22} color={BRAND.slateDark} />
                        )}
                    </TouchableOpacity>

                    {/* Text Field */}
                    <View style={s.textInputBox}>
                        <TextInput
                            placeholder="Type your message..."
                            placeholderTextColor="#94A3B8"
                            value={inputText}
                            onChangeText={setInputText}
                            style={s.textInputField}
                            multiline
                            maxHeight={90}
                        />
                    </View>

                    {/* Send Button */}
                    <TouchableOpacity
                        style={[s.sendBtn, !inputText.trim() && s.sendBtnDisabled]}
                        onPress={() => sendMessage('text')}
                        disabled={!inputText.trim()}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="send" size={17} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            {/* ════ ZOOM IMAGE MODAL ════ */}
            <Modal visible={!!zoomImg} transparent animationType="fade" onRequestClose={() => setZoomImg(null)}>
                <View style={s.zoomOverlay}>
                    <TouchableOpacity style={s.zoomCloseBtn} onPress={() => setZoomImg(null)}>
                        <Ionicons name="close" size={26} color="#FFFFFF" />
                    </TouchableOpacity>
                    {zoomImg && (
                        <Image source={{ uri: zoomImg }} style={s.zoomImageFull} resizeMode="contain" />
                    )}
                </View>
            </Modal>

            {/* ════ OPTIONS MODAL (3-Dots) ════ */}
            <Modal visible={showOptionsModal} transparent animationType="fade" onRequestClose={() => setShowOptionsModal(false)}>
                <Pressable style={s.optionsOverlay} onPress={() => setShowOptionsModal(false)}>
                    <View style={s.optionsPopup}>
                        <TouchableOpacity
                            style={s.optionRow}
                            onPress={() => {
                                setShowOptionsModal(false);
                                handleDirectWhatsApp();
                            }}
                        >
                            <Ionicons name="logo-whatsapp" size={18} color="#10B981" />
                            <Text style={s.optionTxt}>Chat on WhatsApp</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={s.optionRow}
                            onPress={() => {
                                setShowOptionsModal(false);
                                if (targetProfile.phone) {
                                    Linking.openURL(`tel:${targetProfile.phone}`).catch(() => {});
                                }
                            }}
                        >
                            <Ionicons name="call-outline" size={18} color={BRAND.navy} />
                            <Text style={s.optionTxt}>Call Merchant</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={s.optionRow}
                            onPress={() => {
                                setShowOptionsModal(false);
                                navigation.navigate('Main', { screen: 'stores' });
                            }}
                        >
                            <Ionicons name="storefront-outline" size={18} color={BRAND.navy} />
                            <Text style={s.optionTxt}>Visit Store Profile</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
};

const s = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },

    // ── 1. Top Header ──
    topHeader: {
        backgroundColor: BRAND.navy,
        paddingTop: Platform.OS === 'ios' ? 12 : (StatusBar.currentHeight || 24) + 6,
        paddingHorizontal: 14,
        paddingBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(229,169,60,0.2)',
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    partnerBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
    },
    avatarWrap: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: BRAND.navyMid,
        position: 'relative',
    },
    avatarImg: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    statusDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: BRAND.emerald,
        borderWidth: 1.5,
        borderColor: BRAND.navy,
    },
    partnerNameTxt: {
        color: '#FFFFFF',
        fontSize: 14.5,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    partnerStatusTxt: {
        color: BRAND.emeraldLight,
        fontSize: 9.5,
        fontWeight: '600',
        marginTop: 1,
    },
    headerActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    headerWhatsAppBtn: {
        width: 34,
        height: 34,
        borderRadius: 9,
        backgroundColor: '#25D366',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerMoreBtn: {
        width: 34,
        height: 34,
        borderRadius: 9,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // ── 2. Product Context Bar ──
    productBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 9,
        backgroundColor: '#F8FAFC',
        borderBottomWidth: 1,
        borderBottomColor: BRAND.border,
    },
    productImg: {
        width: 38,
        height: 38,
        borderRadius: 8,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: BRAND.border,
    },
    inquiryLabel: {
        fontSize: 9,
        fontWeight: '700',
        color: BRAND.slate,
        textTransform: 'uppercase',
    },
    productTitleTxt: {
        fontSize: 12.5,
        fontWeight: '800',
        color: BRAND.slateDark,
    },
    productPriceTxt: {
        fontSize: 11.5,
        fontWeight: '800',
        color: BRAND.goldDark,
    },
    productActionBtn: {
        backgroundColor: BRAND.navy,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
    },
    productActionBtnTxt: {
        color: '#FFFFFF',
        fontSize: 10.5,
        fontWeight: '800',
    },

    // ── 3. Messages List ──
    listContent: {
        paddingHorizontal: 14,
        paddingVertical: 14,
    },
    msgWrapper: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginVertical: 4,
    },
    msgWrapperMe: {
        justifyContent: 'flex-end',
    },
    msgWrapperThem: {
        justifyContent: 'flex-start',
    },
    themAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        marginRight: 6,
        marginBottom: 4,
    },
    bubble: {
        paddingHorizontal: 13,
        paddingVertical: 9,
        borderRadius: 16,
    },
    bubbleMe: {
        backgroundColor: BRAND.navy,
        borderBottomRightRadius: 3,
    },
    bubbleThem: {
        backgroundColor: '#F1F5F9',
        borderBottomLeftRadius: 3,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    msgText: {
        fontSize: 14,
        lineHeight: 19,
    },
    msgTextMe: {
        color: '#FFFFFF',
        fontWeight: '500',
    },
    msgTextThem: {
        color: BRAND.slateDark,
        fontWeight: '500',
    },
    bubbleImage: {
        width: 210,
        height: 190,
        borderRadius: 10,
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
        paddingHorizontal: 4,
    },
    timeTxt: {
        fontSize: 9.5,
        color: '#94A3B8',
        fontWeight: '500',
    },

    // ── 4. Quick Chips & Input Composer ──
    chipsStrip: {
        paddingVertical: 6,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    quickChipPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: BRAND.border,
    },
    quickChipTxt: {
        fontSize: 10.5,
        fontWeight: '700',
        color: BRAND.slateDark,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        gap: 8,
    },
    attachBtn: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: BRAND.slateLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textInputBox: {
        flex: 1,
        backgroundColor: '#F1F5F9',
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: Platform.OS === 'ios' ? 8 : 4,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    textInputField: {
        fontSize: 13.5,
        color: BRAND.slateDark,
        paddingVertical: 0,
    },
    sendBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: BRAND.navy,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendBtnDisabled: {
        backgroundColor: '#CBD5E1',
    },

    // ── Empty & Loading ──
    loadingBox: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingTxt: {
        fontSize: 12,
        color: BRAND.slate,
        marginTop: 8,
        fontWeight: '600',
    },
    emptyChatBox: {
        alignItems: 'center',
        paddingVertical: 60,
        paddingHorizontal: 24,
    },
    emptyIconWrap: {
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    emptyChatTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: BRAND.slateDark,
    },
    emptyChatSub: {
        fontSize: 12,
        color: BRAND.slate,
        textAlign: 'center',
        marginTop: 6,
        lineHeight: 17,
    },

    // ── Zoom Modal ──
    zoomOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.95)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    zoomCloseBtn: {
        position: 'absolute',
        top: 48,
        right: 20,
        zIndex: 10,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    zoomImageFull: {
        width: '92%',
        height: '80%',
    },

    // ── Options Popup ──
    optionsOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    optionsPopup: {
        position: 'absolute',
        top: 60,
        right: 14,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingVertical: 6,
        width: 180,
        elevation: 6,
        borderWidth: 1,
        borderColor: BRAND.border,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    optionTxt: {
        fontSize: 12.5,
        fontWeight: '600',
        color: BRAND.slateDark,
    },
    embeddedProductCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        padding: 8,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        width: 220,
    },
    embedImg: {
        width: 44,
        height: 44,
        borderRadius: 6,
        backgroundColor: '#F1F5F9',
    },
    embedInfo: {
        flex: 1,
        marginLeft: 8,
        justifyContent: 'center',
    },
    embedTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: BRAND.navy,
        marginBottom: 2,
    },
    embedPrice: {
        fontSize: 11,
        fontWeight: '700',
        color: BRAND.goldDark,
    },
});
