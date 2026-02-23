import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, SectionList, StyleSheet, ActivityIndicator, Animated, ScrollView, Alert, Platform, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles, WIDTH } from '../styles/theme';
import { supabase } from '../lib/supabase';

const FILTERS = ['All', 'Orders', 'Deals', 'Account'];

export const NotificationsPage = ({ onBack }) => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState('All');
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    const [showUnreadOnly, setShowUnreadOnly] = useState(false);

    const unreadCount = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications]);

    useEffect(() => {
        fetchNotifications();

        // Subscribe to real-time changes
        const subscription = supabase
            .channel('notifications_live')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications'
            }, () => {
                fetchNotifications();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, []);

    const fetchNotifications = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setNotifications(data || []);
        } catch (err) {
            console.log("Fetch Notifications Error:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', user.id)
                .eq('is_read', false);

            if (error) throw error;
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        } catch (err) {
            console.log("Mark All Read Error:", err);
        }
    };

    const handleClearAll = () => {
        Alert.alert(
            'Clear Notifications',
            'Are you sure you want to delete all notifications?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear All',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { data: { user } } = await supabase.auth.getUser();
                            if (!user) return;

                            const { error } = await supabase
                                .from('notifications')
                                .delete()
                                .eq('user_id', user.id);

                            if (error) throw error;
                            setNotifications([]);
                        } catch (err) {
                            console.log("Clear All Error:", err);
                        }
                    }
                }
            ]
        );
    };

    const handleDeleteNotification = async (id) => {
        try {
            const { error } = await supabase.from('notifications').delete().eq('id', id);
            if (error) throw error;
            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (err) {
            console.log("Delete Notification Error:", err);
        }
    };

    const filteredNotifications = useMemo(() => {
        return notifications.filter(n => {
            // 1. Filter by unread toggle
            if (showUnreadOnly && n.is_read) return false;

            // 2. Filter by Search
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                if (!n.title?.toLowerCase().includes(query) && !n.message?.toLowerCase().includes(query)) return false;
            }

            // 3. Filter by Category
            if (activeFilter === 'All') return true;
            const type = n.type?.toLowerCase();
            if (activeFilter === 'Orders') return type === 'order' || type === 'shipping';
            if (activeFilter === 'Deals') return type === 'deal' || type === 'promo';
            if (activeFilter === 'Account') return type === 'login' || type === 'welcome' || type === 'security';
            return true;
        });
    }, [notifications, activeFilter, searchQuery, showUnreadOnly]);

    const groupedNotifications = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const groups = {
            'Today': [],
            'Yesterday': [],
            'Earlier': []
        };

        filteredNotifications.forEach(n => {
            const date = new Date(n.created_at);
            date.setHours(0, 0, 0, 0);

            if (date.getTime() === today.getTime()) {
                groups['Today'].push(n);
            } else if (date.getTime() === yesterday.getTime()) {
                groups['Yesterday'].push(n);
            } else {
                groups['Earlier'].push(n);
            }
        });

        return Object.entries(groups).filter(([_, items]) => items.length > 0);
    }, [filteredNotifications]);

    const getIcon = (type) => {
        switch (type?.toLowerCase()) {
            case 'order': return 'cart';
            case 'shipping': return 'navigate-circle';
            case 'login': return 'lock-open';
            case 'welcome': return 'happy';
            case 'deal': return 'flash';
            case 'promo': return 'gift';
            default: return 'notifications';
        }
    };

    const getColor = (type) => {
        switch (type?.toLowerCase()) {
            case 'order': return '#3B82F6';
            case 'shipping': return '#10B981';
            case 'login': return '#F59E0B';
            case 'deal': return '#EF4444';
            case 'promo': return '#8B5CF6';
            default: return '#64748B';
        }
    };

    const renderNotification = ({ item }) => (
        <TouchableOpacity
            activeOpacity={0.7}
            style={[localStyles.card, !item.is_read && localStyles.unread]}
            onPress={async () => {
                if (!item.is_read) {
                    await supabase.from('notifications').update({ is_read: true }).eq('id', item.id);
                    setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, is_read: true } : n));
                }
            }}
        >
            <View style={[localStyles.iconBox, { backgroundColor: getColor(item.type) + '15' }]}>
                <Ionicons name={getIcon(item.type)} size={22} color={getColor(item.type)} />
                {!item.is_read && <View style={localStyles.unreadDot} />}
            </View>
            <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text style={[localStyles.title, !item.is_read && { fontWeight: '800' }]}>{item.title}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={localStyles.time}>
                            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        <TouchableOpacity onPress={() => handleDeleteNotification(item.id)}>
                            <Ionicons name="close-circle-outline" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                    </View>
                </View>
                <Text style={localStyles.message} numberOfLines={2}>{item.message}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            {/* ELITE HEADER */}
            <View style={{ backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#F1F5F9', paddingTop: Platform.OS === 'android' ? 50 : 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, height: 60 }}>
                    <TouchableOpacity onPress={onBack} style={localStyles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color="#0F172A" />
                    </TouchableOpacity>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 20, fontWeight: '900', color: '#0F172A' }}>Notifications</Text>
                        {unreadCount > 0 && (
                            <View style={localStyles.headerBadge}>
                                <Text style={localStyles.headerBadgeText}>{unreadCount}</Text>
                            </View>
                        )}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <TouchableOpacity onPress={handleClearAll}>
                            <Ionicons name="trash-outline" size={22} color="#EF4444" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setShowSettings(true)}>
                            <Ionicons name="settings-outline" size={22} color="#64748B" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* SEARCH BAR */}
                <View style={localStyles.searchContainer}>
                    <Ionicons name="search" size={18} color="#94A3B8" />
                    <TextInput
                        placeholder="Search alerts..."
                        placeholderTextColor="#94A3B8"
                        style={localStyles.searchInput}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* FILTER BAR + UNREAD TOGGLE */}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16, gap: 10 }}>
                        <TouchableOpacity
                            onPress={() => setShowUnreadOnly(!showUnreadOnly)}
                            style={[localStyles.filterChip, showUnreadOnly && { backgroundColor: '#3B82F6', borderColor: '#3B82F6' }]}
                        >
                            <Ionicons name={showUnreadOnly ? "eye-off" : "eye-outline"} size={14} color={showUnreadOnly ? "white" : "#64748B"} />
                        </TouchableOpacity>
                        {FILTERS.map(f => (
                            <TouchableOpacity
                                key={f}
                                onPress={() => setActiveFilter(f)}
                                style={[localStyles.filterChip, activeFilter === f && localStyles.activeFilterChip]}
                            >
                                <Text style={[localStyles.filterText, activeFilter === f && { color: 'white' }]}>{f}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </View>

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color="#0F172A" />
                </View>
            ) : notifications.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                    <View style={localStyles.emptyCircle}>
                        <Ionicons name="notifications-off-outline" size={64} color="#94A3B8" />
                    </View>
                    <Text style={[styles.emptyStateText, { fontSize: 22, color: '#0F172A' }]}>Peace & Quiet</Text>
                    <Text style={styles.emptyStateSub}>When you get notifications, they'll show up here with style.</Text>
                </View>
            ) : (
                <SectionList
                    sections={groupedNotifications.map(([title, data]) => ({ title, data }))}
                    keyExtractor={item => item.id}
                    renderItem={renderNotification}
                    renderSectionHeader={({ section: { title } }) => (
                        <View style={localStyles.sectionLabel}>
                            <Text style={localStyles.sectionLabelText}>{title}</Text>
                        </View>
                    )}
                    contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
                    refreshing={refreshing}
                    onRefresh={() => {
                        setRefreshing(true);
                        fetchNotifications();
                    }}
                    stickySectionHeadersEnabled={false}
                    ListHeaderComponent={
                        notifications.some(n => !n.is_read) && (
                            <TouchableOpacity style={localStyles.markReadHeader} onPress={handleMarkAllRead}>
                                <Ionicons name="checkmark-done" size={16} color="#3B82F6" />
                                <Text style={localStyles.markReadText}>Mark all as read</Text>
                            </TouchableOpacity>
                        )
                    }
                />
            )}
            {/* SETTINGS MODAL */}
            <Modal
                visible={showSettings}
                transparent
                animationType="slide"
                onRequestClose={() => setShowSettings(false)}
            >
                <View style={localStyles.modalOverlay}>
                    <View style={localStyles.modalContent}>
                        <View style={localStyles.modalHeader}>
                            <Text style={localStyles.modalTitle}>Notification Settings</Text>
                            <TouchableOpacity onPress={() => setShowSettings(false)}>
                                <Ionicons name="close" size={24} color="#0F172A" />
                            </TouchableOpacity>
                        </View>

                        <View style={localStyles.settingItem}>
                            <View style={{ flex: 1 }}>
                                <Text style={localStyles.settingLabel}>Push Notifications</Text>
                                <Text style={localStyles.settingSub}>Get real-time alerts on your device.</Text>
                            </View>
                            <Ionicons name="toggle" size={32} color="#10B981" />
                        </View>

                        <View style={localStyles.settingItem}>
                            <View style={{ flex: 1 }}>
                                <Text style={localStyles.settingLabel}>Deal Alerts</Text>
                                <Text style={localStyles.settingSub}>Only get notified about flash sales.</Text>
                            </View>
                            <Ionicons name="toggle" size={32} color="#94A3B8" />
                        </View>

                        <View style={localStyles.settingItem}>
                            <View style={{ flex: 1 }}>
                                <Text style={localStyles.settingLabel}>Email Summaries</Text>
                                <Text style={localStyles.settingSub}>Weekly digest of top offers.</Text>
                            </View>
                            <Ionicons name="toggle" size={32} color="#10B981" />
                        </View>

                        <TouchableOpacity
                            style={localStyles.saveBtn}
                            onPress={() => {
                                Alert.alert('Saved', 'Your preferences have been updated.');
                                setShowSettings(false);
                            }}
                        >
                            <Text style={localStyles.saveBtnText}>Save Preferences</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const localStyles = StyleSheet.create({
    headerBadge: {
        backgroundColor: '#3B82F6',
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6
    },
    headerBadgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: '900'
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        marginHorizontal: 20,
        marginBottom: 16,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9'
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 14,
        color: '#0F172A',
        fontWeight: '600'
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center'
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 25,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        gap: 6
    },
    activeFilterChip: {
        backgroundColor: '#0F172A',
        borderColor: '#0F172A'
    },
    filterText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748B'
    },
    card: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: 'white',
        borderRadius: 20,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        boxShadow: '0px 4px 10px rgba(0,0,0,0.1)',
    },
    unread: {
        backgroundColor: '#F8FAFC',
        borderColor: '#DBEAFE',
        borderLeftWidth: 4,
        borderLeftColor: '#3B82F6'
    },
    iconBox: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
        position: 'relative'
    },
    unreadDot: {
        position: 'absolute',
        top: 2,
        right: 2,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#3B82F6',
        borderWidth: 2,
        borderColor: 'white'
    },
    title: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 4
    },
    message: {
        fontSize: 13,
        color: '#64748B',
        lineHeight: 18
    },
    time: {
        fontSize: 11,
        color: '#94A3B8',
        fontWeight: '600'
    },
    sectionLabel: {
        marginTop: 12,
        marginBottom: 12,
        paddingHorizontal: 4
    },
    sectionLabelText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 1
    },
    markReadHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        backgroundColor: '#EFF6FF',
        borderRadius: 12,
        marginBottom: 20,
        gap: 8
    },
    markReadText: {
        color: '#3B82F6',
        fontWeight: '800',
        fontSize: 13
    },
    emptyCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderStyle: 'dashed'
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        justifyContent: 'flex-end'
    },
    modalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        paddingBottom: 40
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: '#0F172A'
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    settingLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1E293B'
    },
    settingSub: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2
    },
    saveBtn: {
        backgroundColor: '#0F172A',
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 32
    },
    saveBtnText: {
        color: 'white',
        fontWeight: '800',
        fontSize: 16
    }
});
