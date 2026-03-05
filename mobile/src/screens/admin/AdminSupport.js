import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert, TextInput, Modal, ScrollView, Animated, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── HELPERS ────────────────────────────────────────────────────────────────
const fmtDate = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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
            <View key={i} style={{ backgroundColor: 'white', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F1F5F9' }}>
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
        if (!reply.trim()) return Alert.alert('Attention', 'Please write a reply before sending.');
        setSending(true);

        const { error } = await supabase
            .from('support_tickets')
            .update({ status: 'resolved', admin_reply: reply.trim() })
            .eq('id', ticket.id);

        if (error) {
            Alert.alert('Error', error.message);
            setSending(false);
            return;
        }

        if (ticket.user_id) {
            await supabase.from('notifications').insert([{
                user_id: ticket.user_id,
                title: 'Ticket Resolved',
                message: `Admin replied: ${reply.trim().substring(0, 50)}...`,
                type: 'system'
            }]);
        }

        Alert.alert('Success', 'Reply sent and ticket marked as resolved.');
        setSending(false);
        onSuccess();
    };

    if (!ticket) return null;

    const isOpen = ticket.status === 'open';

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' }}>
                <View style={{ backgroundColor: '#F8FAFC', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '90%' }}>

                    {/* Header */}
                    <LinearGradient colors={['#1E1B4B', '#312E81']} style={{ padding: 20, paddingTop: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View style={{ flex: 1, marginRight: 10 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                    <View style={{ backgroundColor: isOpen ? '#FEF3C7' : '#D1FAE5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                                        <Text style={{ fontSize: 10, fontWeight: '800', color: isOpen ? '#D97706' : '#047857', textTransform: 'uppercase' }}>
                                            {ticket.status}
                                        </Text>
                                    </View>
                                    <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#E0E7FF' }}>{ticket.category || 'General'}</Text>
                                    </View>
                                </View>
                                <Text style={{ fontSize: 20, fontWeight: '800', color: 'white', lineHeight: 28 }}>{ticket.subject}</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' }}>
                                <Ionicons name="close" size={20} color="white" />
                            </TouchableOpacity>
                        </View>
                    </LinearGradient>

                    {/* Messages Body */}
                    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 20 }}>

                            {/* Actions Header */}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748B' }}>{fmtDate(ticket.created_at)}</Text>
                                <View style={{ flexDirection: 'row', gap: 12 }}>
                                    {!isOpen && (
                                        <TouchableOpacity onPress={() => onReopen(ticket.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#EFF6FF', borderRadius: 8 }}>
                                            <Ionicons name="refresh" size={14} color="#3B82F6" />
                                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#3B82F6' }}>Reopen</Text>
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity onPress={() => onDelete(ticket.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#FEF2F2', borderRadius: 8 }}>
                                        <Ionicons name="trash" size={14} color="#EF4444" />
                                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#EF4444' }}>Delete</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* User Profile Banner */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'white', padding: 14, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0' }}>
                                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' }}>
                                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#3B82F6' }}>
                                        {ticket.user?.full_name ? ticket.user.full_name.charAt(0).toUpperCase() : '?'}
                                    </Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#0F172A' }}>{ticket.user?.full_name || 'Unknown User'}</Text>
                                    <Text style={{ fontSize: 12, color: '#64748B' }}>{ticket.user?.email || 'No email provided'}</Text>
                                </View>
                            </View>

                            {/* User Message Bubble */}
                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748B', marginLeft: 12, marginBottom: 6 }}>User Message</Text>
                            <View style={{ backgroundColor: 'white', padding: 16, borderRadius: 20, borderTopLeftRadius: 4, shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2, marginBottom: 24 }}>
                                <Text style={{ fontSize: 15, color: '#334155', lineHeight: 24 }}>{ticket.message}</Text>
                            </View>

                            {/* Admin Reply or Action */}
                            {ticket.admin_reply ? (
                                <View style={{ alignItems: 'flex-end', marginBottom: 24 }}>
                                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#10B981', marginRight: 12, marginBottom: 6 }}>Admin Reply</Text>
                                    <LinearGradient colors={['#10B981', '#059669']} style={{ padding: 16, borderRadius: 20, borderTopRightRadius: 4, width: '90%' }}>
                                        <Text style={{ fontSize: 15, color: 'white', lineHeight: 24 }}>{ticket.admin_reply}</Text>
                                    </LinearGradient>
                                </View>
                            ) : (
                                <View style={{ backgroundColor: 'white', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                        <Ionicons name="chatbox-ellipses" size={18} color="#0F172A" />
                                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A' }}>Resolve Ticket</Text>
                                    </View>
                                    <TextInput
                                        style={{ backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 14, fontSize: 15, color: '#0F172A', minHeight: 120, textAlignVertical: 'top' }}
                                        placeholder="Write your definitive reply to the user..."
                                        placeholderTextColor="#94A3B8"
                                        multiline
                                        value={reply}
                                        onChangeText={setReply}
                                    />
                                    <TouchableOpacity
                                        style={{ marginTop: 16, borderRadius: 12, overflow: 'hidden' }}
                                        onPress={handleReply}
                                        disabled={sending}
                                    >
                                        <LinearGradient colors={['#3B82F6', '#2563EB']} style={{ padding: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                                            {sending ? (
                                                <ActivityIndicator color="white" />
                                            ) : (
                                                <>
                                                    <Ionicons name="send" size={18} color="white" />
                                                    <Text style={{ color: 'white', fontWeight: '800', fontSize: 15 }}>Send & Resolve</Text>
                                                </>
                                            )}
                                        </LinearGradient>
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

    // UI State
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all'); // all, open, resolved
    const [selectedTicket, setSelectedTicket] = useState(null);

    const fetchTickets = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('support_tickets')
            .select('*, user:profiles(full_name, email)')
            .order('created_at', { ascending: false });

        if (error && error.code !== '42P01') {
            Alert.alert('Error', error.message);
        } else {
            setTickets(data || []);
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchTickets(); }, [fetchTickets]);

    // ─── Actions ────────────────────────────────────────────────────────────
    const handleDelete = (id) => {
        Alert.alert('Delete Ticket', 'Are you sure you want to permanently delete this ticket?', [
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
        Alert.alert('Reopen Ticket', 'This will mark the ticket as Pending again.', [
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

    // ─── Renderers ──────────────────────────────────────────────────────────
    const renderHeader = () => (
        <LinearGradient colors={['#1E1B4B', '#312E81']} style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: 24, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <View>
                    <Text style={{ fontSize: 28, fontWeight: '900', color: 'white', letterSpacing: -0.5 }}>Support</Text>
                    <Text style={{ fontSize: 14, color: '#A5B4FC', marginTop: 2 }}>{tickets.filter(t => t.status === 'open').length} pending tickets</Text>
                </View>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="chatbubbles" size={22} color="white" />
                </View>
            </View>

            {/* Search */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, paddingHorizontal: 14, height: 46 }}>
                <Ionicons name="search" size={18} color="#A5B4FC" />
                <TextInput
                    style={{ flex: 1, marginLeft: 10, color: 'white', fontSize: 15 }}
                    placeholder="Search messages, names, categories..."
                    placeholderTextColor="#A5B4FC"
                    value={search}
                    onChangeText={setSearch}
                />
                {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')}>
                        <Ionicons name="close-circle" size={18} color="#A5B4FC" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Filters */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, marginTop: 16 }}>
                {['all', 'open', 'resolved'].map(f => {
                    const active = filter === f;
                    const labels = { all: 'All Tickets', open: 'Pending', resolved: 'Resolved' };
                    let count = 0;
                    if (f === 'all') count = tickets.length;
                    if (f === 'open') count = tickets.filter(t => t.status === 'open').length;
                    if (f === 'resolved') count = tickets.filter(t => t.status === 'resolved').length;

                    return (
                        <TouchableOpacity
                            key={f}
                            onPress={() => setFilter(f)}
                            style={{
                                paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                                backgroundColor: active ? 'white' : 'rgba(255,255,255,0.1)',
                                flexDirection: 'row', alignItems: 'center', gap: 6
                            }}
                        >
                            <Text style={{ fontSize: 13, fontWeight: '700', color: active ? '#1E1B4B' : 'white' }}>{labels[f]}</Text>
                            <View style={{ backgroundColor: active ? '#EEF2FF' : 'rgba(255,255,255,0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 }}>
                                <Text style={{ fontSize: 10, fontWeight: '800', color: active ? '#4F46E5' : 'white' }}>{count}</Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </LinearGradient>
    );

    const renderItem = ({ item }) => {
        const isOpen = item.status === 'open';
        return (
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setSelectedTicket(item)}
                style={{
                    backgroundColor: 'white', padding: 16, borderRadius: 16, marginBottom: 12,
                    borderWidth: 1, borderColor: isOpen ? '#FFE4E6' : '#F1F5F9',
                    shadowColor: isOpen ? '#E11D48' : '#94A3B8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1
                }}
            >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <View style={{ flex: 1, marginRight: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isOpen ? '#FFF1F2' : '#F1F5F9', justifyContent: 'center', alignItems: 'center' }}>
                            <Ionicons name={isOpen ? "alert-circle" : "checkmark-done"} size={18} color={isOpen ? "#E11D48" : "#10B981"} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <View style={{ backgroundColor: '#F8FAFC', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#64748B' }}>{item.category || 'General'}</Text>
                                </View>
                                <Text style={{ fontSize: 11, color: '#94A3B8' }}>{fmtDate(item.created_at)}</Text>
                            </View>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 2 }} numberOfLines={1}>{item.subject}</Text>
                        </View>
                    </View>
                    <View style={{ backgroundColor: isOpen ? '#FFF7ED' : '#ECFDF5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: isOpen ? '#C2410C' : '#047857', textTransform: 'uppercase' }}>
                            {item.status}
                        </Text>
                    </View>
                </View>

                <Text style={{ fontSize: 14, color: '#475569', lineHeight: 20, marginBottom: 14 }} numberOfLines={2}>
                    {item.message}
                </Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10 }}>
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', marginRight: 8 }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: '#64748B' }}>
                            {item.user?.full_name ? item.user.full_name.charAt(0).toUpperCase() : '?'}
                        </Text>
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#334155', flex: 1 }} numberOfLines={1}>
                        {item.user?.full_name || 'Unknown User'}
                    </Text>
                    {item.admin_reply && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="return-down-forward" size={14} color="#10B981" />
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#10B981' }}>Replied</Text>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            {renderHeader()}

            {loading ? (
                <SkeletonList />
            ) : (
                <FlatList
                    data={filteredTickets}
                    keyExtractor={i => i.id}
                    renderItem={renderItem}
                    contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 80 }}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 40 }}>
                            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                                <Ionicons name="chatbubbles-outline" size={32} color="#4F46E5" />
                            </View>
                            <Text style={{ fontSize: 18, fontWeight: '800', color: '#1E293B', marginBottom: 6 }}>No Tickets Found</Text>
                            <Text style={{ fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22 }}>
                                {search ? `We couldn't find any tickets matching "${search}"` : "You don't have any support tickets at the moment."}
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
