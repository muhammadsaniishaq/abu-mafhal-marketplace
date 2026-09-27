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
import { resolveVendorOrStore } from '../services/vendorResolver';

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

    const [taggedProduct, setTaggedProduct] = useState(() => {
        if (productId || productName) {
            return {
                id: productId,
                name: productName || 'Product',
                price: productPrice,
                image_url: productImage
            };
        }
        return null;
    });

    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    const [targetId, setTargetId] = useState(vendorId);
    const [uploading, setUploading] = useState(false);
    const [zoomImg, setZoomImg] = useState(null);
    const [showOptionsModal, setShowOptionsModal] = useState(false);
    const [productsCache, setProductsCache] = useState(() => {
        if (productId) {
            return {
                [productId]: {
                    id: productId,
                    name: productName || 'Product',
                    price: productPrice,
                    image_url: productImage
                }
            };
        }
        return {};
    });

    const isSupport = vendorId === 'admin' || vendorId === 'admin_support' || vendorName?.toLowerCase()?.includes('support');

    const [targetProfile, setTargetProfile] = useState({
        full_name: vendorName || (isSupport ? 'Abu Mafhal Support' : 'ABU MAFHAL'),
        avatar_url: vendorAvatar || null,
        role: vendorRole || (isSupport ? 'Official Support' : 'Verified Seller'),
        is_online: true,
        phone: '08145853539',
        whatsapp: '08145853539'
    });

    const flatListRef = useRef(null);

    useEffect(() => {
        initChat();
    }, []);

    // Keep tagged product & productsCache in sync if route params arrive dynamically
    useEffect(() => {
        if (productId) {
            if (!taggedProduct) {
                setTaggedProduct({
                    id: productId,
                    name: productName || 'Product',
                    price: productPrice,
                    image_url: productImage
                });
            }
            if (!productsCache[productId]) {
                if (productName || productImage) {
                    setProductsCache(prev => ({
                        ...prev,
                        [productId]: {
                            id: productId,
                            name: productName || 'Product',
                            price: productPrice,
                            image_url: productImage
                        }
                    }));
                } else {
                    fetchProductInfo(productId);
                }
            }
        }
    }, [productId, productName, productPrice, productImage]);

    // Fetch missing products when messages change
    useEffect(() => {
        messages.forEach(msg => {
            if (msg.product_id && !productsCache[msg.product_id]) {
                fetchProductInfo(msg.product_id);
            }
        });
    }, [messages, productsCache]);

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

            // Resolve target vendor/store using unified resolver
            const vData = await resolveVendorOrStore(targetId);
            const resolvedId = vData.userId || vData.id;
            setTargetId(resolvedId);
            setTargetProfile({
                full_name: vData.name,
                avatar_url: vData.avatar || vData.logo,
                role: vData.isOfficial ? 'Official Flagship Store' : (vData.role || 'Verified Seller'),
                is_online: true,
                phone: vData.phone || '08145853539',
                whatsapp: vData.whatsapp || vData.phone || '08145853539'
            });

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
            const vData = await resolveVendorOrStore(id);
            setTargetProfile(prev => ({
                ...prev,
                full_name: vData.name,
                avatar_url: vData.avatar || vData.logo || prev.avatar_url,
                role: vData.isOfficial ? 'Official Flagship Store' : (vData.role || 'Verified Seller'),
                is_online: true,
                phone: vData.phone || prev.phone,
                whatsapp: vData.whatsapp || prev.whatsapp
            }));
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

        const currentTagged = taggedProduct;
        const msgType = currentTagged ? 'product_inquiry' : type;
        const currentProdId = currentTagged?.id || null;

        const tempId = `temp_${Date.now()}`;
        const optimisticMsg = {
            id: tempId,
            sender_id: currentUser.id,
            receiver_id: activeTargetId,
            message: textToSend,
            media_url: mediaUrl,
            message_type: msgType,
            product_id: currentProdId,
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
                message_type: msgType,
                product_id: currentProdId,
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

    const sendProductInquiry = () => {
        if (!taggedProduct) return;
        const msg = `🛍️ [Product Inquiry: ${taggedProduct.name} - ${fmtPrice(taggedProduct.price)}]\nHello! I want to order this item on Abu Mafhal. Is this item currently in stock for fast delivery?`;
        sendMessage('text', msg);
    };

    const handleDirectWhatsApp = () => {
        const raw = targetProfile.whatsapp || targetProfile.phone || '08145853539';
        const phone = raw.replace(/[^0-9]/g, '');
        const currentTagged = taggedProduct || (productId ? { id: productId, name: productName, price: productPrice } : null);
        const pContext = currentTagged ? ` regarding "${currentTagged.name}" (${fmtPrice(currentTagged.price)})\nLink: https://abumafhal.com/mobile#product/${currentTagged.id || ''}` : '';
        const msg = encodeURIComponent(`Hello ${targetProfile.full_name}, I am chatting with you from Abu Mafhal Marketplace${pContext ? '\n' + pContext : ''}.`);
        Linking.openURL(`https://wa.me/${phone}?text=${msg}`).catch(() => {
            Alert.alert('WhatsApp Call', `Phone number: +${phone}`);
        });
    };

    const quickReplies = taggedProduct ? [
        `Is ${taggedProduct.name} still in stock?`,
        "Can you deliver to my city today?",
        "What is the warranty policy on this?",
        "Can I get a discount for multiple units?"
    ] : [
        "Is this item still available?",
        "Can you deliver to my city today?",
        "What is the warranty policy?",
        "Can I get a discount for bulk order?"
    ];

    const renderMessage = ({ item }) => {
        const isMe = item.sender_id === currentUser?.id;
        const timeStr = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Is this a product inquiry message or has tagged product?
        const targetProdId = item.product_id;
        let embeddedProduct = targetProdId ? (productsCache[targetProdId] || (taggedProduct?.id === targetProdId ? taggedProduct : null)) : null;

        let prodName = embeddedProduct?.name;
        let prodPrice = embeddedProduct?.price;
        let prodImg = embeddedProduct?.image_url;
        let prodId = embeddedProduct?.id || targetProdId;

        const hasInquiryHeader = item.message && item.message.includes('[Product Inquiry:');
        if (!prodName && hasInquiryHeader) {
            const match = item.message.match(/\[Product Inquiry:\s*(.*?)\s*-\s*(.*?)\]/);
            if (match) {
                prodName = match[1];
                prodPrice = match[2];
            }
        }
        if (!prodName && taggedProduct && (item.message_type === 'product_inquiry' || hasInquiryHeader)) {
            prodName = taggedProduct.name;
            prodPrice = taggedProduct.price;
            prodImg = taggedProduct.image_url;
            prodId = taggedProduct.id;
        }

        const showProductCard = (!!targetProdId || hasInquiryHeader) && (!!prodName || !!prodImg);
        const displayMessage = item.message ? item.message.replace(/🛍️\s*\[Product Inquiry:.*?\]\n?/, '').replace(/\[Product Inquiry:.*?\]\n?/, '') : '';

        return (
            <View style={[s.msgWrapper, isMe ? s.msgWrapperMe : s.msgWrapperThem]}>
                {!isMe && (
                    targetProfile.avatar_url ? (
                        <Image
                            source={{ uri: targetProfile.avatar_url }}
                            style={s.themAvatar}
                        />
                    ) : (
                        <View style={[s.themAvatar, { backgroundColor: BRAND.navy, alignItems: 'center', justifyContent: 'center' }]}>
                            <Ionicons name="storefront" size={13} color={BRAND.gold} />
                        </View>
                    )
                )}

                <View style={{ maxWidth: '82%' }}>
                    <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleThem]}>
                        
                        {/* PRODUCT CONTEXT EMBED */}
                        {showProductCard && (
                            <TouchableOpacity 
                                style={[s.embeddedProductCard, isMe ? s.embeddedProductCardMe : s.embeddedProductCardThem]} 
                                activeOpacity={0.85}
                                onPress={() => {
                                    if (prodId) {
                                        navigation.navigate('ProductDetails', {
                                            id: prodId,
                                            productId: prodId,
                                            product: embeddedProduct || { id: prodId, name: prodName, price: prodPrice, image_url: prodImg }
                                        });
                                    }
                                }}
                            >
                                <View style={s.embedTopRow}>
                                    <View style={s.embedBadge}>
                                        <Ionicons name="pricetag" size={10} color={isMe ? BRAND.gold : BRAND.navy} />
                                        <Text style={[s.embedBadgeTxt, isMe && { color: BRAND.gold }]}>TAGGED PRODUCT</Text>
                                    </View>
                                    <Text style={[s.embedTapTxt, isMe && { color: '#93C5FD' }]}>Tap to View ›</Text>
                                </View>
                                <View style={s.embedBody}>
                                    {prodImg ? (
                                        <Image source={{ uri: prodImg }} style={s.embedImg} />
                                    ) : (
                                        <View style={[s.embedImg, { backgroundColor: isMe ? 'rgba(255,255,255,0.1)' : BRAND.slateLight, alignItems: 'center', justifyContent: 'center' }]}>
                                            <Ionicons name="cube-outline" size={18} color={isMe ? BRAND.gold : BRAND.slate} />
                                        </View>
                                    )}
                                    <View style={s.embedInfo}>
                                        <Text numberOfLines={2} style={[s.embedTitle, isMe && { color: '#FFFFFF' }]}>
                                            {prodName || 'Product'}
                                        </Text>
                                        <Text style={[s.embedPrice, isMe && { color: BRAND.gold }]}>
                                            {fmtPrice(prodPrice)}
                                        </Text>
                                    </View>
                                </View>
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
                            displayMessage.length > 0 ? (
                                <Text style={[s.msgText, isMe ? s.msgTextMe : s.msgTextThem]}>
                                    {displayMessage}
                                </Text>
                            ) : null
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
                        {targetProfile.avatar_url ? (
                            <Image
                                source={{ uri: targetProfile.avatar_url }}
                                style={s.avatarImg}
                            />
                        ) : (
                            <View style={[s.avatarImg, { backgroundColor: BRAND.navyMid, alignItems: 'center', justifyContent: 'center' }]}>
                                <Ionicons name="storefront" size={18} color={BRAND.gold} />
                            </View>
                        )}
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
            {taggedProduct && (
                <View style={s.productBar}>
                    {taggedProduct.image_url ? (
                        <Image
                            source={{ uri: typeof taggedProduct.image_url === 'string' && taggedProduct.image_url.startsWith('http') ? taggedProduct.image_url : 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=300' }}
                            style={s.productImg}
                        />
                    ) : (
                        <View style={[s.productImg, { alignItems: 'center', justifyContent: 'center', backgroundColor: BRAND.slateLight }]}>
                            <Ionicons name="cube-outline" size={18} color={BRAND.slate} />
                        </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="pricetag" size={11} color={BRAND.emerald} />
                            <Text style={s.inquiryLabel}>TAGGED PRODUCT</Text>
                        </View>
                        <Text numberOfLines={1} style={s.productTitleTxt}>{taggedProduct.name || 'Special Item'}</Text>
                        <Text style={s.productPriceTxt}>{fmtPrice(taggedProduct.price)}</Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {/* 1-tap Send Inquiry Button */}
                        <TouchableOpacity
                            style={s.sendInquiryBtn}
                            onPress={sendProductInquiry}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="paper-plane" size={11} color="#FFFFFF" />
                            <Text style={s.sendInquiryBtnTxt}>Inquire</Text>
                        </TouchableOpacity>

                        {/* View Item Button */}
                        <TouchableOpacity
                            style={s.productActionBtn}
                            onPress={() => {
                                navigation.navigate('ProductDetails', {
                                    id: taggedProduct.id,
                                    productId: taggedProduct.id,
                                    product: taggedProduct
                                });
                            }}
                            activeOpacity={0.8}
                        >
                            <Text style={s.productActionBtnTxt}>View</Text>
                        </TouchableOpacity>

                        {/* Untag Button */}
                        <TouchableOpacity
                            style={s.untagBtn}
                            onPress={() => setTaggedProduct(null)}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Ionicons name="close" size={15} color={BRAND.slate} />
                        </TouchableOpacity>
                    </View>
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
                            {taggedProduct && (
                                <TouchableOpacity
                                    style={s.emptyInquiryCard}
                                    onPress={sendProductInquiry}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="pricetag" size={15} color={BRAND.navy} />
                                    <Text numberOfLines={1} style={s.emptyInquiryCardTxt}>
                                        Send inquiry for "{taggedProduct.name}"
                                    </Text>
                                    <Ionicons name="paper-plane" size={13} color={BRAND.navy} />
                                </TouchableOpacity>
                            )}
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

                {/* Active Tag Indicator Strip */}
                {taggedProduct && (
                    <View style={s.inputTagBanner}>
                        <View style={s.inputTagLeft}>
                            <View style={s.inputTagIconBox}>
                                <Ionicons name="pricetag" size={12} color={BRAND.navy} />
                            </View>
                            <Text numberOfLines={1} style={s.inputTagTxt}>
                                Tagging: <Text style={s.inputTagBold}>{taggedProduct.name}</Text> ({fmtPrice(taggedProduct.price)})
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={s.inputTagCloseBtn}
                            onPress={() => setTaggedProduct(null)}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Ionicons name="close-circle" size={18} color={BRAND.slate} />
                        </TouchableOpacity>
                    </View>
                )}

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
                            placeholder={taggedProduct ? `Inquire about ${taggedProduct.name}...` : "Type your message..."}
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
    sendInquiryBtn: {
        backgroundColor: BRAND.emerald,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 6,
    },
    sendInquiryBtnTxt: {
        color: '#FFFFFF',
        fontSize: 10.5,
        fontWeight: '800',
    },
    productActionBtn: {
        backgroundColor: BRAND.navy,
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 6,
    },
    productActionBtnTxt: {
        color: '#FFFFFF',
        fontSize: 10.5,
        fontWeight: '800',
    },
    untagBtn: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.06)',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 2,
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
    emptyInquiryCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: BRAND.gold,
        borderRadius: 20,
        paddingVertical: 9,
        paddingHorizontal: 14,
        marginTop: 16,
        gap: 6,
        maxWidth: 320,
    },
    emptyInquiryCardTxt: {
        color: BRAND.navy,
        fontWeight: '800',
        fontSize: 12,
        flexShrink: 1,
    },
    inputTagBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#EFF6FF',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#BFDBFE',
        paddingHorizontal: 14,
        paddingVertical: 6,
    },
    inputTagLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 6,
        marginRight: 8,
    },
    inputTagIconBox: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#DBEAFE',
        alignItems: 'center',
        justifyContent: 'center',
    },
    inputTagTxt: {
        fontSize: 11.5,
        color: BRAND.slateDark,
        flex: 1,
    },
    inputTagBold: {
        fontWeight: '800',
        color: BRAND.navy,
    },
    inputTagCloseBtn: {
        padding: 2,
    },
    embeddedProductCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        padding: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        width: 230,
    },
    embeddedProductCardMe: {
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        borderColor: 'rgba(229, 169, 60, 0.4)',
    },
    embeddedProductCardThem: {
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
    },
    embedTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 5,
        marginBottom: 5,
        borderBottomWidth: 0.5,
        borderBottomColor: 'rgba(150, 150, 150, 0.25)',
    },
    embedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    embedBadgeTxt: {
        fontSize: 9,
        fontWeight: '800',
        color: BRAND.navy,
        letterSpacing: 0.3,
    },
    embedTapTxt: {
        fontSize: 9.5,
        fontWeight: '700',
        color: BRAND.sky,
    },
    embedBody: {
        flexDirection: 'row',
        alignItems: 'center',
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
        fontWeight: '700',
        color: BRAND.navy,
        marginBottom: 2,
    },
    embedPrice: {
        fontSize: 11.5,
        fontWeight: '800',
        color: BRAND.goldDark,
    },
});
