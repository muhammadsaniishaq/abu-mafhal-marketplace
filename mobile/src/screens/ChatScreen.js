import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, SafeAreaView, ActivityIndicator, Image, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { styles } from '../styles/theme';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

export const ChatScreen = ({ route, navigation }) => {
    // Initial params from navigation
    const { productId, vendorId, vendorName, productImage, vendorAvatar, productName, productPrice, vendorRole } = route.params || {};

    // State
    // State
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    const [targetId, setTargetId] = useState(vendorId); // State for the resolved UUID

    // Determine initial profile state based on vendorId
    const isSupport = vendorId === 'admin' || vendorId === 'admin_support';
    const [targetProfile, setTargetProfile] = useState({
        full_name: isSupport ? 'Abu Mafhal Support' : (vendorName || 'User'),
        avatar_url: vendorAvatar || null,
        role: isSupport ? 'Support Team' : (vendorRole || 'Vendor'), // Use passed role first
        is_online: isSupport, // Support is always "online"
        last_seen: isSupport ? new Date().toISOString() : null
    });
    const [uploading, setUploading] = useState(false);

    const flatListRef = useRef(null);

    // 1. Get Current User & Resolve Target ID
    useEffect(() => {
        console.log("ChatScreen Init. Params:", { vendorId, vendorName, productId, vendorRole });
        getCurrentUser();
        // If it's admin, we set the profile to Support immediately (done in useState), 
        // but we still need to resolve the UUID for messaging.
        if (targetId === 'admin') {
            resolveAdminId();
        } else {
            console.log("Target ID is already UUID (likely):", targetId);
            // Refresh profile to get online status/role updates, but respect passed role if 'Admin'
            fetchTargetProfile(targetId);
        }
    }, []);

    // ... (keep useEffect for fetching messages same)

    const getCurrentUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            console.log("Current User:", user.id);
            setCurrentUser(user);
        } else {
            setLoading(false);
            Alert.alert('Auth Required', 'Please login to chat');
            navigation.goBack();
        }
    };

    const resolveAdminId = async () => {
        console.log("Resolving Admin ID...");
        try {
            // Find a user with role 'admin'
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, role')
                .eq('role', 'admin')
                .limit(1)
                .single();

            if (data && !error) {
                console.log("Resolved Admin ID:", data.id);
                setTargetId(data.id);
                // Update profile with real admin data
                setTargetProfile(prev => ({
                    ...prev,
                    full_name: data.full_name || 'Abu Mafhal Admin',
                    avatar_url: data.avatar_url || prev.avatar_url,
                    role: 'Admin'
                }));
            } else {
                console.log("No admin found in profiles. Error:", error);
                // Fallback: If you have a specific hardcoded support UUID, use it here.
                // Otherwise, this chat will fail to save messages to 'admin' string if UUID required.
                Alert.alert('Support Unavailable', 'No support agent is currently available. Messages may not send.');
            }
        } catch (e) {
            console.log('Error resolving admin:', e);
        }
    };

    const fetchTargetProfile = async (id) => {
        // Special handle for Admin/Support
        if (id === 'admin' || id === 'admin_support') {
            setTargetProfile({
                full_name: 'Abu Mafhal Support',
                avatar_url: null,
                role: 'Support Team',
                is_online: true,
                last_seen: new Date().toISOString()
            });
            return;
        }

        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('full_name, avatar_url, last_seen, role, email') // Fetch email for check
                .eq('id', id)
                .single();

            if (data && !error) {
                // Admin Check: Role or Email List (Consistent with ProductDetails)
                const ADMIN_EMAILS = ['muhammadsaniisyaku3@gmail.com', 'muhammadsanish0@gmail.com', 'abumafhalhub@gmail.com'];
                const isAdmin = (data.role === 'admin' || data.role === 'Admin') || (data.email && ADMIN_EMAILS.includes(data.email)) || (vendorRole === 'Admin');

                setTargetProfile(prev => ({
                    ...prev,
                    full_name: data.full_name || prev.full_name,
                    avatar_url: data.avatar_url || prev.avatar_url,
                    role: isAdmin ? 'Admin' : (data.role || 'Vendor'),
                    last_seen: data.last_seen
                }));
            }
        } catch (e) {
            console.log('Error fetching target profile:', e);
        }
    };

    const fetchMessages = async (id) => {
        try {
            console.log("Fetching messages for:", id);
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${id}),and(sender_id.eq.${id},receiver_id.eq.${currentUser.id})`)
                .order('created_at', { ascending: true });

            if (!error && data) {
                console.log("Messages fetched:", data.length);
                setMessages(data);
            }
        } catch (err) {
            console.log('Error fetching messages:', err);
        } finally {
            setLoading(false);
        }
    };

    const subscribeToMessages = (id) => {
        const channel = supabase
            .channel(`chat:${currentUser.id}:${id}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages' },
                (payload) => {
                    const newMsg = payload.new;
                    if (
                        (newMsg.sender_id === currentUser.id && newMsg.receiver_id === id) ||
                        (newMsg.sender_id === id && newMsg.receiver_id === currentUser.id)
                    ) {
                        setMessages((prev) => [...prev, newMsg]);
                        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
                    }
                }
            )
            .subscribe();

        return () => supabase.removeChannel(channel);
    };

    const subscribeToPresence = (id) => {
        const channel = supabase.channel('online_users', {
            config: {
                presence: {
                    key: currentUser.id,
                },
            },
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                const newState = channel.presenceState();
                const isTargetOnline = Object.keys(newState).includes(id);
                setTargetProfile(prev => ({ ...prev, is_online: isTargetOnline }));
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({ online_at: new Date().toISOString() });
                }
            });

        return () => supabase.removeChannel(channel);
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.7,
            base64: true,
        });

        if (!result.canceled) {
            uploadAndSendImage(result.assets[0]);
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

            if (error) {
                if (error.message.includes('Bucket not found') || error.message.includes('row-level security')) {
                    Alert.alert('Configuration Error', 'Please create a public bucket named "chat-images" in Supabase Storage.');
                }
                throw error;
            }

            const { data: { publicUrl } } = supabase.storage
                .from(BUCKET)
                .getPublicUrl(filePath);

            await sendMessage('image', publicUrl);

        } catch (error) {
            console.log("Upload Error:", error);
            Alert.alert('Upload Failed', 'Could not upload image. Ensure "products" bucket exists and is public.');
        } finally {
            setUploading(false);
        }
    };

    const sendMessage = async (type = 'text', content = null) => {
        const textToSend = type === 'text' ? inputText.trim() : '📷 Image';
        const mediaUrl = type === 'image' ? content : null;

        console.log("Attempting to send message:", { type, textToSend, targetId, currentUserId: currentUser?.id });

        // Ensure we have a valid target UUID, not 'admin' string
        if ((!textToSend && !mediaUrl) || !targetId || targetId === 'admin') {
            if (targetId === 'admin') {
                console.warn("Blocked send: TargetID is still 'admin'");
                Alert.alert('Connecting...', 'Still connecting to support agent. Please wait...');
                resolveAdminId(); // Retry resolution
            } else if (!currentUser) {
                console.warn("Blocked send: No Current User");
                Alert.alert("Error", "You are not logged in.");
            }
            return;
        }

        setInputText('');

        const newMessage = {
            sender_id: currentUser.id,
            receiver_id: targetId,
            message: textToSend,
            media_url: mediaUrl,
            message_type: type,
            created_at: new Date().toISOString(),
        };

        // Optimistic
        setMessages((prev) => [...prev, { ...newMessage, id: Date.now().toString() }]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

        try {
            const payload = {
                sender_id: currentUser.id,
                receiver_id: targetId,
                message: textToSend,
                media_url: mediaUrl,
                message_type: type
            };
            console.log("Inserting payload:", payload);

            const { data, error } = await supabase.from('messages').insert(payload).select();

            if (error) {
                console.error("Supabase Insert Error Full:", JSON.stringify(error, null, 2));
                throw error;
            }
            console.log("Message Sent Successfully:", data);

        } catch (error) {
            console.error("Send Catch Error:", error);

            // Fallback: If 'messages' table is missing or columns are wrong
            if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('relation "public.messages" does not exist')) {
                Alert.alert(
                    "Database Configuration Required",
                    "The 'messages' table is missing or has the wrong columns.\n\nPlease run the 'fix_chat_schema.sql' script in your Supabase SQL Editor to fix this."
                );
                return;
            }

            Alert.alert(
                "Send Failed",
                `Could not save message.\n\nError: ${error.message}\n\nPlease check your Database Table 'messages' columns. Expected: 'message', 'sender_id', 'receiver_id'.`
            );
        }
    };

    const renderMessage = ({ item }) => {
        const isMe = item.sender_id === currentUser?.id;
        return (
            <View style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', marginVertical: 4, maxWidth: '80%' }}>
                <View style={{
                    backgroundColor: isMe ? '#0F172A' : '#F1F5F9',
                    padding: item.message_type === 'image' ? 4 : 12,
                    borderRadius: 16,
                    borderBottomRightRadius: isMe ? 4 : 16,
                    borderBottomLeftRadius: isMe ? 16 : 4
                }}>
                    {item.message_type === 'image' ? (
                        <TouchableOpacity onPress={() => {/* Maybe open full screen */ }}>
                            <Image
                                source={{ uri: item.media_url }}
                                style={{ width: 200, height: 200, borderRadius: 12, backgroundColor: '#CBD5E1' }}
                                resizeMode="cover"
                            />
                        </TouchableOpacity>
                    ) : (
                        <Text style={{ color: isMe ? 'white' : '#0F172A', fontSize: 15 }}>{item.message}</Text>
                    )}
                </View>
                <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 2, alignSelf: isMe ? 'flex-end' : 'flex-start', marginHorizontal: 4 }}>
                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: 'white', paddingTop: Platform.OS === 'android' ? 50 : 0 }}>
            {/* Header */}
            <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
                    <Ionicons name="arrow-back" size={24} color="#0F172A" />
                </TouchableOpacity>

                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', marginLeft: 12, overflow: 'hidden' }}>
                    {targetProfile.avatar_url ? (
                        <Image source={{ uri: targetProfile.avatar_url }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="person" size={20} color="#94A3B8" />
                        </View>
                    )}
                </View>

                <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>{targetProfile.full_name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, color: '#64748B', marginRight: 8, fontWeight: '600' }}>
                            {targetProfile.role ? targetProfile.role.charAt(0).toUpperCase() + targetProfile.role.slice(1) : 'Vendor'}
                        </Text>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: targetProfile.is_online ? '#10B981' : '#CBD5E1', marginRight: 4 }} />
                        <Text style={{ fontSize: 12, color: targetProfile.is_online ? '#10B981' : '#94A3B8' }}>
                            {targetProfile.is_online ? 'Online' : 'Offline'}
                        </Text>
                    </View>
                </View>

                {/* Secure Badge */}
                <Ionicons name="shield-checkmark" size={20} color="#10B981" />
            </View>

            {/* Product Context Banner */}
            {(productName || productImage) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#F8FAFC', margin: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
                    {productImage && <Image source={{ uri: getProductImage(productImage) }} style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: '#E2E8F0' }} />}
                    <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text style={{ fontSize: 12, color: '#64748B' }}>Inquiry about:</Text>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#0F172A' }} numberOfLines={1}>{productName || 'Product'}</Text>
                        {productPrice && <Text style={{ fontSize: 13, color: '#3B82F6', fontWeight: '700' }}>₦{productPrice.toLocaleString()}</Text>}
                    </View>
                </View>
            )}

            {/* Messages List */}
            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item, i) => item.id ? item.id.toString() : i.toString()}
                renderItem={renderMessage}
                contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />

            {/* Input Area */}
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
                <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9', flexDirection: 'row', alignItems: 'center', backgroundColor: 'white' }}>
                    <TouchableOpacity onPress={pickImage} style={{ padding: 8 }}>
                        {uploading ? <ActivityIndicator size="small" color="#94A3B8" /> : <Ionicons name="image-outline" size={28} color="#94A3B8" />}
                    </TouchableOpacity>

                    <View style={{ flex: 1, backgroundColor: '#F1F5F9', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, marginHorizontal: 8 }}>
                        <TextInput
                            placeholder="Type a message..."
                            value={inputText}
                            onChangeText={setInputText}
                            style={{ fontSize: 15, maxHeight: 100 }}
                            multiline
                        />
                    </View>

                    <TouchableOpacity
                        onPress={() => sendMessage('text')}
                        style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: inputText.trim() ? '#0F172A' : '#E2E8F0', alignItems: 'center', justifyContent: 'center' }}
                        disabled={!inputText.trim()}
                    >
                        <Ionicons name="send" size={20} color="white" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

// Helper
const getProductImage = (imgs) => {
    if (!imgs) return null;
    if (typeof imgs === 'string') {
        try { return JSON.parse(imgs)[0]; } catch (e) { return imgs; }
    }
    if (Array.isArray(imgs) && imgs.length > 0) return imgs[0];
    return null;
};
