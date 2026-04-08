import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert, ActivityIndicator, Image } from 'react-native';
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
                .select(`
                    *,
                    profiles(full_name, email, username),
                    drivers(name),
                    products(name)
                `)
                .eq('status', statusFilter)
                .order('created_at', { ascending: false })
                .limit(100);

            const { data, error } = await query;
            console.log(`Fetched ${data?.length || 0} reviews for ${statusFilter}`);

            if (error) {
                console.error("Fetch Reviews Error:", error);
                Alert.alert('Error', 'Failed to fetch reviews: ' + error.message);
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
        <View style={{ flexDirection: 'row', gap: 2 }}>
            {[1, 2, 3, 4, 5].map(s => (
                <Ionicons key={s} name="star" size={12} color={s <= rating ? "#F59E0B" : "#E2E8F0"} />
            ))}
        </View>
    );

    const renderItem = ({ item }) => {
        const userName = item.profiles?.full_name || item.profiles?.username || item.profiles?.email || 'Anonymous';
        const targetName = item.review_type === 'driver'
            ? (item.drivers?.name || 'Driver')
            : (item.products?.name || 'Product');

        return (
            <View style={{ backgroundColor: 'white', padding: 16, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <Text style={{ fontWeight: '800', color: '#0F172A', fontSize: 14 }}>{userName}</Text>
                            <View style={{ backgroundColor: item.review_type === 'driver' ? '#FEF2F2' : '#EFF6FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                <Text style={{ fontSize: 9, color: item.review_type === 'driver' ? '#DC2626' : '#2563EB', fontWeight: '900' }}>
                                    {item.review_type === 'driver' ? 'DRIVER' : 'PRODUCT'}
                                </Text>
                            </View>
                        </View>
                        <Text numberOfLines={1} style={{ fontSize: 11, color: '#64748B', fontWeight: '600' }}>
                            To: <Text style={{ color: '#0F172A' }}>{targetName}</Text>
                        </Text>
                    </View>
                    {renderStars(item.rating)}
                </View>

                {item.title ? (
                    <Text style={{ fontWeight: '700', color: '#1E293B', marginBottom: 4, fontSize: 13 }}>{item.title}</Text>
                ) : null}

                <Text style={{ color: '#475569', fontSize: 13, lineHeight: 18, marginBottom: 12 }}>{item.comment}</Text>

                {item.images && item.images.length > 0 && (
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                        {item.images.map((img, idx) => (
                            <Image
                                key={idx}
                                source={{ uri: img }}
                                style={{ width: 50, height: 50, borderRadius: 8, backgroundColor: '#F8FAFC' }}
                            />
                        ))}
                    </View>
                )}

                <View style={{ flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: '#F8FAFC', paddingTop: 12 }}>
                    <TouchableOpacity
                        onPress={() => handleAction(item.id, 'rejected')}
                        style={{ flex: 1, paddingVertical: 8, alignItems: 'center' }}
                    >
                        <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 13 }}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => handleAction(item.id, 'approved')}
                        style={{ flex: 1, backgroundColor: '#0F172A', paddingVertical: 8, borderRadius: 12, alignItems: 'center' }}
                    >
                        <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>Approve</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <View style={{ padding: 20, backgroundColor: 'white', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, paddingBottom: 24 }}>
                <Text style={[styles.sectionTitle, { marginTop: 0, marginLeft: 0 }]}>Review Feedback</Text>
                <Text style={{ color: '#64748B', fontSize: 12, marginBottom: 16 }}>Moderate incoming customer reviews and driver ratings.</Text>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                    {['all', 'product', 'driver'].map(t => (
                        <TouchableOpacity
                            key={t}
                            onPress={() => setTypeFilter(t)}
                            style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: typeFilter === t ? '#2563EB' : '#F1F5F9' }}
                        >
                            <Text style={{ color: typeFilter === t ? 'white' : '#64748B', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>{t}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    {['pending', 'approved', 'rejected'].map(f => (
                        <TouchableOpacity
                            key={f}
                            onPress={() => setStatusFilter(f)}
                            style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: statusFilter === f ? '#0F172A' : '#F1F5F9', flex: 1, alignItems: 'center' }}
                        >
                            <Text style={{ color: statusFilter === f ? 'white' : '#64748B', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>{f}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#0F172A" />
                </View>
            ) : (
                <FlatList
                    data={reviews}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: 16, paddingTop: 20 }}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', marginTop: 100 }}>
                            <Ionicons name="chatbox-outline" size={48} color="#CBD5E1" />
                            <Text style={{ textAlign: 'center', color: '#94A3B8', marginTop: 12, fontWeight: '600' }}>No {statusFilter} reviews found.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
};
