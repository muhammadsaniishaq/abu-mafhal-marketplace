import React, { useState, useEffect, useCallback } from 'react';
import { 
    View, Text, TouchableOpacity, FlatList, Alert, 
    ActivityIndicator, Image, StyleSheet, RefreshControl, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

const NAVY = '#0E1A2E';
const DEEP_NAVY = '#1E293B';
const GOLD = '#D9A73A';

export const AdminReviews = () => {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [statusFilter, setStatusFilter] = useState('pending'); // pending, approved, rejected
    const [typeFilter, setTypeFilter] = useState('all'); // all, product, driver

    const fetchReviews = useCallback(async () => {
        try {
            setLoading(true);
            let query = supabase
                .from('reviews')
                .select(`
                    *,
                    profiles(full_name, email, username),
                    drivers(name),
                    products(name)
                `)
                .order('created_at', { ascending: false })
                .limit(100);

            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter);
            }

            if (typeFilter !== 'all') {
                query = query.eq('review_type', typeFilter);
            }

            const { data, error } = await query;

            if (error) {
                console.error("Fetch Reviews Error:", error.message);
                Alert.alert('Kuskure', 'An gaza loda reviews: ' + error.message);
            } else {
                setReviews(data || []);
            }
        } catch (err) {
            console.error("Fetch Reviews Crash:", err);
            Alert.alert('Hanyar Sadarwa', 'Ba a samu nasarar haduwa da tsarin reviews ba.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [statusFilter, typeFilter]);

    useEffect(() => {
        fetchReviews();
    }, [fetchReviews]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchReviews();
    };

    const handleAction = async (id, status) => {
        const { error } = await supabase.from('reviews').update({ status }).eq('id', id);
        if (!error) {
            Alert.alert('An Sabunta', `An canza matsayin review zuwa "${status.toUpperCase()}".`);
            setReviews(prev => prev.filter(r => r.id !== id));
        } else {
            Alert.alert('Kuskure', error.message);
        }
    };

    const handleDelete = (id) => {
        Alert.alert('Goge Review', 'Shin kana son goge wannan ra\'ayin gaba daya?', [
            { text: 'A\'a', style: 'cancel' },
            {
                text: 'Eh, Goge',
                style: 'destructive',
                onPress: async () => {
                    const { error } = await supabase.from('reviews').delete().eq('id', id);
                    if (!error) {
                        setReviews(prev => prev.filter(r => r.id !== id));
                    } else {
                        Alert.alert('Kuskure', error.message);
                    }
                }
            }
        ]);
    };

    const renderStars = (rating) => (
        <View style={{ flexDirection: 'row', gap: 2 }}>
            {[1, 2, 3, 4, 5].map(s => (
                <Ionicons 
                    key={s} 
                    name={s <= rating ? "star" : "star-outline"} 
                    size={14} 
                    color={s <= rating ? GOLD : "#CBD5E1"} 
                />
            ))}
        </View>
    );

    const renderItem = ({ item }) => {
        const userName = item.profiles?.full_name || item.profiles?.username || item.profiles?.email || 'Bako (Anonymous)';
        const targetName = item.review_type === 'driver'
            ? (item.drivers?.name || 'Direban Isar da Kaya')
            : (item.products?.name || 'Kayan Kasuwa');

        return (
            <View style={s.card}>
                <View style={s.cardHeader}>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <Text style={s.userName} numberOfLines={1}>{userName}</Text>
                            <View style={[s.typeBadge, { backgroundColor: item.review_type === 'driver' ? '#FFFBEB' : '#EFF6FF' }]}>
                                <Text style={[s.typeBadgeText, { color: item.review_type === 'driver' ? '#D97706' : '#2563EB' }]}>
                                    {item.review_type === 'driver' ? 'DIREBA' : 'KAYA'}
                                </Text>
                            </View>
                        </View>
                        <Text numberOfLines={1} style={s.targetInfo}>
                            Ga: <Text style={{ color: NAVY, fontWeight: '700' }}>{targetName}</Text>
                        </Text>
                    </View>
                    {renderStars(item.rating || 5)}
                </View>

                {item.title ? (
                    <Text style={s.reviewTitle}>{item.title}</Text>
                ) : null}

                <Text style={s.commentText}>{item.comment}</Text>

                {item.images && Array.isArray(item.images) && item.images.length > 0 && (
                    <View style={s.imageRow}>
                        {item.images.map((img, idx) => (
                            <Image
                                key={idx}
                                source={{ uri: img }}
                                style={s.reviewImage}
                            />
                        ))}
                    </View>
                )}

                <View style={s.cardActions}>
                    <TouchableOpacity
                        onPress={() => handleDelete(item.id)}
                        style={s.deleteBtn}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="trash-outline" size={15} color="#EF4444" />
                        <Text style={s.deleteBtnText}>Goge</Text>
                    </TouchableOpacity>

                    {item.status !== 'rejected' && (
                        <TouchableOpacity
                            onPress={() => handleAction(item.id, 'rejected')}
                            style={s.rejectBtn}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="close-circle-outline" size={15} color="#EF4444" />
                            <Text style={s.rejectBtnText}>Kin Karba</Text>
                        </TouchableOpacity>
                    )}

                    {item.status !== 'approved' && (
                        <TouchableOpacity
                            onPress={() => handleAction(item.id, 'approved')}
                            style={s.approveBtn}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="checkmark-circle" size={15} color={NAVY} />
                            <Text style={s.approveBtnText}>Karba (Approve)</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    return (
        <View style={s.container}>
            {/* Header */}
            <View style={s.header}>
                <View style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="star" size={22} color={GOLD} />
                        <Text style={s.headerTitle}>Bitar Kayan Kasuwa (Reviews)</Text>
                    </View>
                    <Text style={s.headerSubtitle}>Tace ra'ayoyin abokan ciniki kan kaya da direbobi</Text>
                </View>

                {/* Type Filter */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                    {[
                        { id: 'all', label: 'Duka Nau\'i' },
                        { id: 'product', label: 'Kayan Kasuwa' },
                        { id: 'driver', label: 'Direbobi' }
                    ].map(t => (
                        <TouchableOpacity
                            key={t.id}
                            onPress={() => setTypeFilter(t.id)}
                            style={[s.typeFilterPill, typeFilter === t.id && s.typeFilterPillActive]}
                            activeOpacity={0.8}
                        >
                            <Text style={[s.typeFilterText, typeFilter === t.id && s.typeFilterTextActive]}>
                                {t.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Status Filter */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    {[
                        { id: 'pending', label: 'Jiran Taciya (Pending)' },
                        { id: 'approved', label: 'Wadanda Aka Karba' },
                        { id: 'rejected', label: 'Wadanda Aka Ki' }
                    ].map(f => (
                        <TouchableOpacity
                            key={f.id}
                            onPress={() => setStatusFilter(f.id)}
                            style={[s.statusFilterBtn, statusFilter === f.id && s.statusFilterBtnActive]}
                            activeOpacity={0.8}
                        >
                            <Text style={[s.statusFilterText, statusFilter === f.id && s.statusFilterTextActive]}>
                                {f.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {loading ? (
                <View style={s.centered}>
                    <ActivityIndicator size="large" color={GOLD} />
                    <Text style={s.loadingText}>Ana binciko reviews...</Text>
                </View>
            ) : (
                <FlatList
                    data={reviews}
                    renderItem={renderItem}
                    keyExtractor={item => item.id ? item.id.toString() : Math.random().toString()}
                    contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[GOLD, NAVY]} />}
                    ListEmptyComponent={
                        <View style={s.emptyBox}>
                            <View style={s.emptyIconCircle}>
                                <Ionicons name="chatbox-outline" size={40} color={GOLD} />
                            </View>
                            <Text style={s.emptyTitle}>Babu Ra'ayi A Yanzu</Text>
                            <Text style={s.emptySub}>
                                Babu wani review na {typeFilter.toUpperCase()} a matsayin {statusFilter.toUpperCase()} a wannan lokacin.
                            </Text>
                        </View>
                    }
                />
            )}
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
    typeFilterPill: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 12,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    typeFilterPillActive: {
        backgroundColor: NAVY,
        borderColor: NAVY
    },
    typeFilterText: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '800'
    },
    typeFilterTextActive: {
        color: GOLD
    },
    statusFilterBtn: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center'
    },
    statusFilterBtnActive: {
        backgroundColor: '#FFFBEB',
        borderColor: GOLD
    },
    statusFilterText: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '800',
        textAlign: 'center'
    },
    statusFilterTextActive: {
        color: NAVY,
        fontWeight: '900'
    },
    card: {
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 18,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 1,
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 10
    },
    userName: {
        fontWeight: '800',
        color: NAVY,
        fontSize: 14
    },
    typeBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6
    },
    typeBadgeText: {
        fontSize: 9,
        fontWeight: '900'
    },
    targetInfo: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '500'
    },
    reviewTitle: {
        fontWeight: '800',
        color: NAVY,
        marginBottom: 4,
        fontSize: 13
    },
    commentText: {
        color: '#475569',
        fontSize: 13,
        lineHeight: 19,
        marginBottom: 12
    },
    imageRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 14
    },
    reviewImage: {
        width: 54,
        height: 54,
        borderRadius: 8,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    cardActions: {
        flexDirection: 'row',
        gap: 8,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingTop: 12
    },
    deleteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: '#FEF2F2'
    },
    deleteBtnText: {
        color: '#EF4444',
        fontWeight: '700',
        fontSize: 12
    },
    rejectBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#CBD5E1'
    },
    rejectBtnText: {
        color: '#64748B',
        fontWeight: '700',
        fontSize: 12
    },
    approveBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: GOLD,
        paddingVertical: 8,
        borderRadius: 10
    },
    approveBtnText: {
        color: NAVY,
        fontWeight: '900',
        fontSize: 12
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40
    },
    loadingText: {
        marginTop: 12,
        color: '#64748B',
        fontSize: 14,
        fontWeight: '600'
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
    }
});
