import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    View, Text, TouchableOpacity, FlatList, ActivityIndicator, 
    Alert, TextInput, Modal, ScrollView, Animated, KeyboardAvoidingView, 
    Platform, StyleSheet, RefreshControl, Linking 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { whatsappService } from '../../services/whatsappService';

const NAVY = '#0E1A2E';
const DEEP_NAVY = '#1E293B';
const GOLD = '#D9A73A';

// ─── HELPERS ────────────────────────────────────────────────────────────────
const fmtDate = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// ─── SKELETON ─────────────────────────────────────────────────────────────
const SkeletonPulse = ({ style }) => {
    const anim = React.useRef(new Animated.Value(0.3)).current;
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
                Animated.timing(anim, { toValue: 0.3, duration: 800, useNativeDriver: true })
            ])
        ).start();
    }, []);
    return <Animated.View style={[style, { opacity: anim, backgroundColor: '#E2E8F0' }]} />;
};

const SkeletonList = () => (
    <View style={{ padding: 14, gap: 12 }}>
        {[1, 2, 3, 4].map(i => (
            <View key={i} style={s.skeletonCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                    <SkeletonPulse style={{ width: '60%', height: 16, borderRadius: 4 }} />
                    <SkeletonPulse style={{ width: 60, height: 24, borderRadius: 12 }} />
                </View>
                <SkeletonPulse style={{ width: '100%', height: 12, borderRadius: 4, marginBottom: 6 }} />
                <SkeletonPulse style={{ width: '80%', height: 12, borderRadius: 4, marginBottom: 12 }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <SkeletonPulse style={{ width: 24, height: 24, borderRadius: 12 }} />
                    <SkeletonPulse style={{ width: 100, height: 10, borderRadius: 4 }} />
                </View>
            </View>
        ))}
    </View>
);

// ─── TICKET DETAILS MODAL ────────────────────────────────────────────────────
const TicketDetailsModal = ({ visible, ticket, onClose, onSuccess, onDelete, onReopen }) => {
    const insets = useSafeAreaInsets();
    const [reply, setReply] = useState('');
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (visible) setReply('');
    }, [visible, ticket]);

    const handleReply = async () => {
        if (!reply.trim()) return Alert.alert('Error', 'Please write a reply before sending.');
        setSending(true);

        try {
            const { error } = await supabase
                .from('support_tickets')
                .update({ status: 'resolved', admin_reply: reply.trim() })
                .eq('id', ticket.id);

            if (error) {
                Alert.alert('Error', error.message);
                setSending(false);
                return;
            }

            // Insert in-app notification with correct schema
            if (ticket.user_id) {
                await supabase.from('notifications').insert([{
                    user_id: ticket.user_id,
                    title: 'Ticket Resolved',
                    body: `Admin resolved your inquiry regarding "${ticket.subject}": ${reply.trim().substring(0, 80)}...`,
                    is_read: false,
                    data: {
                        type: 'support',
                        ticket_id: ticket.id
                    }
                }]);
            }

            // WhatsApp Notification if available
            if (ticket.user?.phone) {
                const supportMsg = `Hello! Your inquiry regarding "${ticket.subject}" has been resolved on Abu-Mafhal Marketplace. Response: ${reply.trim().substring(0, 80)}... Please check the app for details.`;
                whatsappService.sendDirect(ticket.user.phone, supportMsg, ticket.user_id)
                    .catch(e => console.log('Support Reply WhatsApp Error:', e));
            }

            Alert.alert('Reply Sent', 'Your reply has been sent and this ticket has been marked as resolved.');
            setSending(false);
            onSuccess();
        } catch (e) {
            console.error('Reply catch:', e);
            Alert.alert('Error', e.message);
            setSending(false);
        }
    };

    const handleOpenWhatsApp = () => {
        if (!ticket.user?.phone) {
            Alert.alert('No Phone Number', 'This user does not have a phone number registered on their account.');
            return;
        }
        let cleanPhone = ticket.user.phone.replace(/[^0-9]/g, '');
        if (cleanPhone.startsWith('0')) cleanPhone = '234' + cleanPhone.slice(1);
        const text = encodeURIComponent(`Hello ${ticket.user.full_name || ''}, from Abu-Mafhal Customer Support regarding your ticket: "${ticket.subject}".`);
        Linking.openURL(`https://wa.me/${cleanPhone}?text=${text}`);
    };

    if (!ticket) return null;

    const isOpen = ticket.status === 'open';

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={s.modalOverlay}>
                <View style={s.modalCard}>
                    {/* Header */}
                    <View style={s.modalHeader}>
                        <View style={{ flex: 1, marginRight: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <View style={[s.badgePill, { backgroundColor: isOpen ? '#FEF3C7' : '#DCFCE7' }]}>
                                    <Text style={[s.badgePillText, { color: isOpen ? '#D97706' : '#059669' }]}>
                                        {isOpen ? 'PENDING' : 'RESOLVED'}
                                    </Text>
                                </View>
                                <View style={s.catBadge}>
                                    <Text style={s.catBadgeText}>{ticket.category || 'General'}</Text>
                                </View>
                            </View>
                            <Text style={s.modalTicketSubject}>{ticket.subject}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={s.closeModalBtn}>
                            <Ionicons name="close" size={20} color={NAVY} />
                        </TouchableOpacity>
                    </View>

                    {/* Messages Body */}
                    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 20 }}>
                            {/* Actions Header */}
                            <View style={s.ticketMetaRow}>
                                <Text style={s.ticketMetaDate}>{fmtDate(ticket.created_at)}</Text>
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    {!isOpen && (
                                        <TouchableOpacity onPress={() => onReopen(ticket.id)} style={s.reopenBtn}>
                                            <Ionicons name="refresh" size={14} color={NAVY} />
                                            <Text style={s.reopenBtnText}>Reopen</Text>
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity onPress={() => onDelete(ticket.id)} style={s.deleteBtn}>
                                        <Ionicons name="trash" size={14} color="#EF4444" />
                                        <Text style={s.deleteBtnText}>Delete</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* User Profile Banner */}
                            <View style={s.userBanner}>
                                <View style={s.userAvatarCircle}>
                                    <Text style={s.userAvatarText}>
                                        {ticket.user?.full_name ? ticket.user.full_name.charAt(0).toUpperCase() : '?'}
                                    </Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.userNameText}>{ticket.user?.full_name || 'Guest User'}</Text>
                                    <Text style={s.userEmailText}>{ticket.user?.email || ticket.user?.phone || 'No contact info'}</Text>
                                </View>
                                {ticket.user?.phone && (
                                    <TouchableOpacity 
                                        style={s.whatsAppDirectBtn}
                                        onPress={handleOpenWhatsApp}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="logo-whatsapp" size={16} color="#16A34A" />
                                        <Text style={s.whatsAppDirectText}>Chat</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* User Message Bubble */}
                            <Text style={s.bubbleLabel}>CUSTOMER INQUIRY</Text>
                            <View style={s.userMessageBubble}>
                                <Text style={s.userMessageText}>{ticket.message}</Text>
                            </View>

                            {/* Admin Reply or Action */}
                            {ticket.admin_reply ? (
                                <View style={{ alignItems: 'flex-end', marginBottom: 24 }}>
                                    <Text style={[s.bubbleLabel, { color: '#059669', marginRight: 8 }]}>ADMIN RESOLUTION</Text>
                                    <View style={s.adminReplyBubble}>
                                        <Text style={s.adminReplyText}>{ticket.admin_reply}</Text>
                                    </View>
                                </View>
                            ) : (
                                <View style={s.replyBox}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                        <Ionicons name="chatbox-ellipses" size={18} color={NAVY} />
                                        <Text style={s.replyBoxTitle}>Reply to Ticket & Resolve</Text>
                                    </View>
                                    <TextInput
                                        style={s.replyInput}
                                        placeholder="Type your reply to this customer here..."
                                        placeholderTextColor="#94A3B8"
                                        multiline
                                        value={reply}
                                        onChangeText={setReply}
                                    />
                                    <TouchableOpacity
                                        style={s.sendReplyBtn}
                                        onPress={handleReply}
                                        disabled={sending}
                                        activeOpacity={0.85}
                                    >
                                        {sending ? (
                                            <ActivityIndicator color={NAVY} />
                                        ) : (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <Ionicons name="checkmark-done-circle" size={18} color={NAVY} />
                                                <Text style={s.sendReplyBtnText}>Send Reply & Resolve</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            )}
                        </ScrollView>
                    </KeyboardAvoidingView>
                </View>
            </View>
        </Modal>
    );
};

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
export const AdminSupport = () => {
    const insets = useSafeAreaInsets();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // UI State
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all'); // all, open, resolved
    const [selectedTicket, setSelectedTicket] = useState(null);

    const fetchTickets = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('support_tickets')
                .select('*, user:profiles(full_name, email, phone)')
                .order('created_at', { ascending: false });

            if (error && error.code !== '42P01') {
                console.warn('Error fetching support tickets:', error.message);
            } else {
                setTickets(data || []);
            }
        } catch (e) {
            console.error('Fetch support catch:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchTickets(); }, [fetchTickets]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchTickets();
    };

    // ─── Actions ────────────────────────────────────────────────────────────
    const handleDelete = (id) => {
        Alert.alert('Delete Ticket', 'Are you sure you want to delete this ticket permanently?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    const { error } = await supabase.from('support_tickets').delete().eq('id', id);
                    if (error) {
                        Alert.alert('Error', error.message);
                    } else {
                        setTickets(prev => prev.filter(t => t.id !== id));
                        if (selectedTicket?.id === id) setSelectedTicket(null);
                    }
                }
            }
        ]);
    };

    const handleReopen = (id) => {
        Alert.alert('Reopen Ticket', 'This will reopen the ticket back to Pending status.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Reopen', onPress: async () => {
                    const { error } = await supabase.from('support_tickets').update({ status: 'open', admin_reply: null }).eq('id', id);
                    if (error) {
                        Alert.alert('Error', error.message);
                    } else {
                        setTickets(prev => prev.map(t => t.id === id ? { ...t, status: 'open', admin_reply: null } : t));
                        setSelectedTicket(null);
                    }
                }
            }
        ]);
    };

    // ─── Filter & Search ───────────────────────────────────────────────────
    const filteredTickets = useMemo(() => {
        let list = tickets;
        if (filter === 'open') list = list.filter(t => t.status === 'open');
        if (filter === 'resolved') list = list.filter(t => t.status === 'resolved');

        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(t =>
                (t.subject && t.subject.toLowerCase().includes(q)) ||
                (t.category && t.category.toLowerCase().includes(q)) ||
                (t.message && t.message.toLowerCase().includes(q)) ||
                (t.user?.full_name && t.user.full_name.toLowerCase().includes(q)) ||
                (t.user?.email && t.user.email.toLowerCase().includes(q))
            );
        }
        return list;
    }, [tickets, search, filter]);

    const renderHeader = () => (
        <View style={[s.header, { paddingTop: Platform.OS === 'ios' ? insets.top + 10 : 16 }]}>
            <View style={s.headerRow}>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="chatbubbles" size={22} color={GOLD} />
                        <Text style={s.headerTitle}>Customer Support</Text>
                    </View>
                    <Text style={s.headerSubtitle}>
                        {tickets.filter(t => t.status === 'open').length} inquiries pending response
                    </Text>
                </View>
            </View>

            {/* Search */}
            <View style={s.searchBar}>
                <Ionicons name="search" size={16} color={GOLD} />
                <TextInput
                    style={s.searchInput}
                    placeholder="Search by subject, name or category..."
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

            {/* Filter Tabs */}
            <View style={s.filterRow}>
                {[
                    { id: 'all', label: 'All Tickets', count: tickets.length },
                    { id: 'open', label: 'Pending', count: tickets.filter(t => t.status === 'open').length },
                    { id: 'resolved', label: 'Resolved', count: tickets.filter(t => t.status === 'resolved').length },
                ].map(f => {
                    const active = filter === f.id;
                    return (
                        <TouchableOpacity
                            key={f.id}
                            onPress={() => setFilter(f.id)}
                            style={[s.filterPill, active && s.filterPillActive]}
                            activeOpacity={0.8}
                        >
                            <Text style={[s.filterPillText, active && s.filterPillTextActive]}>{f.label}</Text>
                            <View style={[s.countBadge, active && s.countBadgeActive]}>
                                <Text style={[s.countBadgeText, active && s.countBadgeTextActive]}>{f.count}</Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );

    const renderItem = ({ item }) => {
        const isOpen = item.status === 'open';
        return (
            <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setSelectedTicket(item)}
                style={[s.ticketCard, isOpen && s.ticketCardOpen]}
            >
                <View style={s.ticketTop}>
                    <View style={{ flex: 1, marginRight: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                        <View style={[s.statusIconCircle, { backgroundColor: isOpen ? '#FEF3C7' : '#ECFDF5' }]}>
                            <Ionicons 
                                name={isOpen ? "alert-circle" : "checkmark-done"} 
                                size={18} 
                                color={isOpen ? "#D97706" : "#059669"} 
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <View style={s.categoryTag}>
                                    <Text style={s.categoryTagText}>{item.category || 'General'}</Text>
                                </View>
                                <Text style={s.dateText}>{fmtDate(item.created_at)}</Text>
                            </View>
                            <Text style={s.subjectText} numberOfLines={1}>{item.subject}</Text>
                        </View>
                    </View>
                    <View style={[s.statusTag, { backgroundColor: isOpen ? '#FEF3C7' : '#ECFDF5' }]}>
                        <Text style={[s.statusTagText, { color: isOpen ? '#D97706' : '#059669' }]}>
                            {isOpen ? 'OPEN' : 'RESOLVED'}
                        </Text>
                    </View>
                </View>

                <Text style={s.messagePreview} numberOfLines={2}>
                    {item.message}
                </Text>

                <View style={s.ticketFooter}>
                    <View style={s.footerAvatar}>
                        <Text style={s.footerAvatarText}>
                            {item.user?.full_name ? item.user.full_name.charAt(0).toUpperCase() : '?'}
                        </Text>
                    </View>
                    <Text style={s.footerUserName} numberOfLines={1}>
                        {item.user?.full_name || 'Guest User'}
                    </Text>
                    {item.admin_reply ? (
                        <View style={s.repliedBadge}>
                            <Ionicons name="return-down-forward" size={13} color="#059669" />
                            <Text style={s.repliedBadgeText}>Replied</Text>
                        </View>
                    ) : (
                        <View style={s.pendingBadge}>
                            <Ionicons name="time-outline" size={13} color="#D97706" />
                            <Text style={s.pendingBadgeText}>Pending</Text>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={s.container}>
            {renderHeader()}

            {loading ? (
                <SkeletonList />
            ) : (
                <FlatList
                    data={filteredTickets}
                    keyExtractor={i => i.id ? i.id.toString() : Math.random().toString()}
                    renderItem={renderItem}
                    contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[GOLD, NAVY]} />}
                    ListEmptyComponent={
                        <View style={s.emptyBox}>
                            <View style={s.emptyIconCircle}>
                                <Ionicons name="chatbubbles-outline" size={36} color={GOLD} />
                            </View>
                            <Text style={s.emptyTitle}>No Support Tickets</Text>
                            <Text style={s.emptySub}>
                                {search 
                                    ? `No support inquiries matching "${search}"` 
                                    : "No customer support inquiries submitted yet."}
                            </Text>
                        </View>
                    }
                />
            )}

            <TicketDetailsModal
                visible={!!selectedTicket}
                ticket={selectedTicket}
                onClose={() => setSelectedTicket(null)}
                onSuccess={() => { setSelectedTicket(null); fetchTickets(); }}
                onDelete={handleDelete}
                onReopen={handleReopen}
            />
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
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12
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
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 9,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 12
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        color: NAVY,
        fontSize: 13,
        fontWeight: '600'
    },
    filterRow: {
        flexDirection: 'row',
        gap: 8
    },
    filterPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 16,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        gap: 6
    },
    filterPillActive: {
        backgroundColor: NAVY,
        borderColor: NAVY
    },
    filterPillText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B'
    },
    filterPillTextActive: {
        color: GOLD,
        fontWeight: '800'
    },
    countBadge: {
        backgroundColor: '#E2E8F0',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 8
    },
    countBadgeActive: {
        backgroundColor: 'rgba(217, 167, 58, 0.25)'
    },
    countBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#64748B'
    },
    countBadgeTextActive: {
        color: GOLD
    },
    ticketCard: {
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 1,
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4
    },
    ticketCardOpen: {
        borderColor: '#FDE68A'
    },
    ticketTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 10
    },
    statusIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center'
    },
    categoryTag: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6
    },
    categoryTagText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#475569'
    },
    dateText: {
        fontSize: 11,
        color: '#94A3B8'
    },
    subjectText: {
        fontSize: 15,
        fontWeight: '800',
        color: NAVY
    },
    statusTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10
    },
    statusTagText: {
        fontSize: 10,
        fontWeight: '800'
    },
    messagePreview: {
        fontSize: 13,
        color: '#475569',
        lineHeight: 18,
        marginBottom: 12
    },
    ticketFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        padding: 8,
        borderRadius: 10
    },
    footerAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#FFFBEB',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#FDE68A'
    },
    footerAvatarText: {
        fontSize: 10,
        fontWeight: '800',
        color: NAVY
    },
    footerUserName: {
        fontSize: 12,
        fontWeight: '700',
        color: NAVY,
        flex: 1
    },
    repliedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6
    },
    repliedBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#059669'
    },
    pendingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#FFFBEB',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6
    },
    pendingBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#D97706'
    },
    skeletonCard: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0'
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(14, 26, 46, 0.65)',
        justifyContent: 'flex-end'
    },
    modalCard: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        height: '90%'
    },
    modalHeader: {
        paddingHorizontal: 20,
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
    },
    badgePill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8
    },
    badgePillText: {
        fontSize: 10,
        fontWeight: '800'
    },
    catBadge: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8
    },
    catBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#475569'
    },
    modalTicketSubject: {
        fontSize: 18,
        fontWeight: '900',
        color: NAVY,
        lineHeight: 22
    },
    closeModalBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center'
    },
    ticketMetaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16
    },
    ticketMetaDate: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B'
    },
    reopenBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: '#FFFBEB',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FDE68A'
    },
    reopenBtnText: {
        fontSize: 11,
        fontWeight: '800',
        color: NAVY
    },
    deleteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: '#FEF2F2',
        borderRadius: 8
    },
    deleteBtnText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#EF4444'
    },
    userBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#F8FAFC',
        padding: 12,
        borderRadius: 14,
        marginBottom: 18,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    userAvatarCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFFBEB',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FDE68A'
    },
    userAvatarText: {
        fontSize: 15,
        fontWeight: '800',
        color: NAVY
    },
    userNameText: {
        fontSize: 14,
        fontWeight: '800',
        color: NAVY
    },
    userEmailText: {
        fontSize: 11,
        color: '#64748B'
    },
    whatsAppDirectBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#DCFCE7',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#86EFAC'
    },
    whatsAppDirectText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#16A34A'
    },
    bubbleLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: '#64748B',
        marginLeft: 8,
        marginBottom: 6,
        letterSpacing: 0.5
    },
    userMessageBubble: {
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 20
    },
    userMessageText: {
        fontSize: 14,
        color: '#334155',
        lineHeight: 22
    },
    adminReplyBubble: {
        backgroundColor: '#ECFDF5',
        padding: 16,
        borderRadius: 16,
        width: '92%',
        borderWidth: 1,
        borderColor: '#A7F3D0'
    },
    adminReplyText: {
        fontSize: 14,
        color: '#065F46',
        lineHeight: 22,
        fontWeight: '600'
    },
    replyBox: {
        backgroundColor: '#FFFFFF',
        padding: 18,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    replyBoxTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: NAVY
    },
    replyInput: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        padding: 12,
        fontSize: 14,
        color: NAVY,
        minHeight: 100,
        textAlignVertical: 'top'
    },
    sendReplyBtn: {
        marginTop: 14,
        borderRadius: 14,
        backgroundColor: GOLD,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center'
    },
    sendReplyBtnText: {
        color: NAVY,
        fontWeight: '900',
        fontSize: 14
    }
});
