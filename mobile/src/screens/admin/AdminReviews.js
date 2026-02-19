import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { styles } from '../../styles/theme';

export const AdminReviews = () => {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('pending'); // pending, approved, rejected

    useEffect(() => {
        fetchReviews();
    }, [filter]);

    const fetchReviews = async () => {
        setLoading(true);
        // Assuming products table exists, join if possible, else just show ID
        const { data, error } = await supabase
            .from('reviews')
            .select('*, user:profiles(full_name)')
            .eq('status', filter)
            .order('created_at', { ascending: false });

        if (error) console.log(error);
        setReviews(data || []);
        setLoading(false);
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
            <View style={{ flexDirection: 'row', justifyConent: 'space-between', marginBottom: 8 }}>
                <View>
                    <Text style={{ fontWeight: '700', color: '#0F172A' }}>{item.user?.full_name || 'Anonymous'}</Text>
                    <Text style={{ fontSize: 10, color: '#94A3B8' }}>Prod: {item.product_id?.slice(0, 8)}...</Text>
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
                    {['pending', 'approved', 'rejected'].map(f => (
                        <TouchableOpacity
                            key={f}
                            onPress={() => setFilter(f)}
                            style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: filter === f ? '#0F172A' : '#F1F5F9' }}
                        >
                            <Text style={{ color: filter === f ? 'white' : '#64748B', fontSize: 12, fontWeight: '600', textTransform: 'capitalize' }}>{f}</Text>
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
