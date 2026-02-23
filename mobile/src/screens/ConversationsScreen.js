import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, SafeAreaView, ActivityIndicator, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { styles } from '../styles/theme';

export const ConversationsScreen = ({ navigation }) => {
    const [loading, setLoading] = useState(true);
    const [conversations, setConversations] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        getCurrentUser();
    }, []);

    const getCurrentUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setCurrentUser(user);
            fetchConversations(user.id);
        } else {
            setLoading(false);
        }
    };

    const fetchConversations = async (userId) => {
        try {
            // Fetch all messages involving the user
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
                .order('created_at', { ascending: false });

            if (data && !error) {
                // Group by conversation partner
                const groups = {};

                data.forEach(msg => {
                    const partnerId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;

                    // Only keep the latest message for each partner
                    if (!groups[partnerId]) {
                        groups[partnerId] = {
                            partnerId,
                            lastMessage: msg,
                            unreadCount: 0 // Logic for unread would go here if we had 'read' status
                        };
                    }
                });

                // Fetch Partner Profiles
                const partnerIds = Object.keys(groups);
                if (partnerIds.length > 0) {
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('id, full_name, avatar_url')
                        .in('id', partnerIds);

                    if (profiles) {
                        profiles.forEach(p => {
                            if (groups[p.id]) {
                                groups[p.id].partnerProfile = p;
                            }
                        });
                    }
                }

                setConversations(Object.values(groups));
            }
        } catch (error) {
            console.log('Error fetching conversations:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderItem = ({ item }) => {
        const profile = item.partnerProfile || { full_name: 'Unknown User', avatar_url: null };
        const msg = item.lastMessage;
        const time = new Date(msg.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

        return (
            <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}
                onPress={() => navigation.navigate('ChatScreen', {
                    vendorId: item.partnerId,
                    vendorName: profile.full_name,
                    vendorAvatar: profile.avatar_url
                })}
            >
                {/* Avatar */}
                <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#F1F5F9', overflow: 'hidden', marginRight: 16 }}>
                    {profile.avatar_url ? (
                        <Image source={{ uri: profile.avatar_url }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="person" size={24} color="#CBD5E1" />
                        </View>
                    )}
                </View>

                {/* Info */}
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>{profile.full_name}</Text>
                        <Text style={{ fontSize: 12, color: '#94A3B8' }}>{time}</Text>
                    </View>
                    <Text style={{ fontSize: 14, color: '#64748B' }} numberOfLines={1}>
                        {msg.sender_id === currentUser?.id ? 'You: ' : ''}{msg.message_type === 'image' ? '📷 Image' : msg.message}
                    </Text>
                </View>

                <Ionicons name="chevron-forward" size={16} color="#E2E8F0" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <SafeAreaView style={{ backgroundColor: 'white' }}>
                <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
                        <Ionicons name="arrow-back" size={24} color="#0F172A" />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 18, fontWeight: '700', marginLeft: 16, color: '#0F172A' }}>Messages</Text>
                </View>
            </SafeAreaView>

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#0F172A" />
                </View>
            ) : (
                <FlatList
                    data={conversations}
                    keyExtractor={item => item.partnerId}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', marginTop: 100, padding: 20 }}>
                            <Ionicons name="chatbubbles-outline" size={64} color="#CBD5E1" />
                            <Text style={{ marginTop: 16, color: '#94A3B8', textAlign: 'center' }}>You haven't chatted with anyone yet.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}
