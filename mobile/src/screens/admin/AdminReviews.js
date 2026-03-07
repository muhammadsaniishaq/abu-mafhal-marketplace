import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { styles } from '../../styles/theme';

export const AdminReviews = () => {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('pending'); // pending, approved, rejected
    const [typeFilter, setTypeFilter] = useState('all'); // all, product, driver

    useEffect(() => {
        fetchReviews();
    }, [statusFilter, typeFilter]);

    const fetchReviews = async () => {
        try {
            setLoading(true);
            let query = supabase
                .from('reviews')
                .select('*, user:profiles(full_name), driver:drivers(name)')
                .eq('status', statusFilter)
                .order('created_at', { ascending: false })
                .limit(100);

            if (typeFilter !== 'all') {
                query = query.eq('review_type', typeFilter);
            }

            const { data, error } = await query;

            if (error) {
                console.error("Fetch Reviews Error:", error);
                Alert.alert('Error', 'Failed to fetch reviews.');
            } else {
                setReviews(data || []);
            }
        } catch (err) {
            console.error("Fetch Reviews Crash:", err);
            Alert.alert('Network Error', 'Could not connect to review server.');
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (id, status) => {
        const { error } = await supabase.from('reviews').update({ status }).eq('id', id);
        if (!error) {
            Alert.alert('Success', `Review ${status}`);
            setReviews(prev => prev.filter(r => r.id !== id));
        } else {
            Alert.alert('Error', error.message);
        }
    };

    const renderStars = (rating) => (
        <View style={{ flexDirection: 'row' }}>
            {[1, 2, 3, 4, 5].map(s => (
                <Ionicons key={s} name="star" size={14} color={s <= rating ? "#F59E0B" : "#CBD5E1"} />
            ))}
        </View>
    );

    const renderItem = ({ item }) => (
        <View style={{ backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontWeight: '700', color: '#0F172A' }}>{item.user?.full_name || 'Anonymous'}</Text>
                        <View style={{ backgroundColor: item.review_type === 'driver' ? '#FEF2F2' : '#EFF6FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                            <Text style={{ fontSize: 9, color: item.review_type === 'driver' ? '#DC2626' : '#2563EB', fontWeight: 'bold' }}>
                                {item.review_type === 'driver' ? 'DRIVER' : 'PRODUCT'}
                            </Text>
                        </View>
                    </View>
                    <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
                        {item.review_type === 'driver'
                            ? `Driver: ${item.driver?.name || item.driver_id?.slice(0, 8)}...`
                            : `Prod: ${item.product_id?.slice(0, 8)}...`}
                    </Text>
                </View>
                {renderStars(item.rating)}
            </View>
            <Text style={{ color: '#334155', fontSize: 13, marginBottom: 12 }}>"{item.comment}"</Text>

            <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
                <TouchableOpacity onPress={() => handleAction(item.id, 'rejected')} style={{ padding: 8 }}>
                    <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 12 }}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => handleAction(item.id, 'approved')}
                    style={{ backgroundColor: '#0F172A', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 }}
                >
                    <Text style={{ color: 'white', fontWeight: '600', fontSize: 12 }}>Approve</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={{ flex: 1, backgroundColor: 'white' }}>
            <View style={{ padding: 20 }}>
                <Text style={styles.sectionTitle}>Reviews Moderation</Text>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    {['all', 'product', 'driver'].map(t => (
                        <TouchableOpacity
                            key={t}
                            onPress={() => setTypeFilter(t)}
                            style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: typeFilter === t ? '#2563EB' : '#EFF6FF' }}
                        >
                            <Text style={{ color: typeFilter === t ? 'white' : '#2563EB', fontSize: 12, fontWeight: '700', textTransform: 'capitalize' }}>{t}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                    {['pending', 'approved', 'rejected'].map(f => (
                        <TouchableOpacity
                            key={f}
                            onPress={() => setStatusFilter(f)}
                            style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: statusFilter === f ? '#0F172A' : '#F1F5F9' }}
                        >
                            <Text style={{ color: statusFilter === f ? 'white' : '#64748B', fontSize: 12, fontWeight: '600', textTransform: 'capitalize' }}>{f}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {loading ? <ActivityIndicator color="#0F172A" /> : (
                <FlatList
                    data={reviews}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: 20 }}
                    ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#94A3B8', marginTop: 20 }}>No reviews found.</Text>}
                />
            )}
        </View>
    );
};
