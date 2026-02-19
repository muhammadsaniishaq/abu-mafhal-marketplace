import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, StyleSheet, Image, ActivityIndicator, FlatList, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles, WIDTH } from '../styles/theme';
import { supabase } from '../lib/supabase';

export const WishlistPage = ({ onBack, onAddToCart, onProductClick }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchWishlist();
    }, []);

    const fetchWishlist = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 1. Get wishlist IDs
            const { data, error } = await supabase
                .from('wishlists')
                .select('items')
                .eq('id', user.id)
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            const itemIds = data?.items || [];
            if (itemIds.length === 0) {
                setItems([]);
                return;
            }

            // 2. Fetch product details for those IDs
            const { data: products, error: pError } = await supabase
                .from('products')
                .select('*')
                .in('id', itemIds);

            if (pError) throw pError;
            setItems(products || []);
        } catch (err) {
            console.log("Fetch Wishlist Error:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRemove = async (productId) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const newItems = items.filter(item => item.id !== productId).map(i => i.id);

            const { error } = await supabase
                .from('wishlists')
                .upsert({ id: user.id, items: newItems, updated_at: new Date() });

            if (error) throw error;
            setItems(prev => prev.filter(item => item.id !== productId));
        } catch (err) {
            console.log("Remove Wishlist Error:", err);
        }
    };

    const handleAddToCart = (product) => {
        onAddToCart(product);
        Alert.alert('Success', `${product.name} added to cart!`);
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity
            activeOpacity={0.9}
            style={localStyles.itemCard}
            onPress={() => onProductClick(item)}
        >
            <Image source={{ uri: item.image || (item.images && item.images[0]) }} style={localStyles.itemImage} resizeMode="cover" />

            <TouchableOpacity
                style={localStyles.removeBtn}
                onPress={() => handleRemove(item.id)}
            >
                <Ionicons name="heart" size={18} color="#EF4444" />
            </TouchableOpacity>

            <View style={localStyles.itemInfo}>
                <Text style={localStyles.itemTitle} numberOfLines={1}>{item.name}</Text>
                <Text style={localStyles.itemPrice}>₦{item.price?.toLocaleString() || '0'}</Text>

                <TouchableOpacity
                    style={localStyles.addCartBtn}
                    onPress={() => handleAddToCart(item)}
                >
                    <Ionicons name="cart-outline" size={16} color="white" />
                    <Text style={localStyles.addCartText}>Add to Cart</Text>
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            {/* ELITE HEADER */}
            <View style={localStyles.header}>
                <View style={localStyles.headerTop}>
                    <TouchableOpacity onPress={onBack} style={localStyles.iconCircle}>
                        <Ionicons name="arrow-back" size={24} color="#0F172A" />
                    </TouchableOpacity>
                    <Text style={localStyles.headerTitle}>My Wishlist</Text>
                    <View style={{ width: 40 }} />
                </View>
            </View>

            {loading ? (
                <View style={localStyles.center}>
                    <ActivityIndicator size="large" color="#0F172A" />
                </View>
            ) : items.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                    <View style={localStyles.emptyCircle}>
                        <Ionicons name="heart-dislike-outline" size={64} color="#94A3B8" />
                    </View>
                    <Text style={[styles.emptyStateText, { fontSize: 22, color: '#0F172A' }]}>Your Wishlist is Empty</Text>
                    <Text style={styles.emptyStateSub}>Save items you love here to find them easily later.</Text>
                    <TouchableOpacity style={localStyles.ctaBtn} onPress={onBack}>
                        <Text style={localStyles.ctaText}>Start Shopping</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={items}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    numColumns={2}
                    columnWrapperStyle={{ justifyContent: 'space-between' }}
                    contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                    refreshing={refreshing}
                    onRefresh={() => {
                        setRefreshing(true);
                        fetchWishlist();
                    }}
                />
            )}
        </View>
    );
};

const localStyles = StyleSheet.create({
    header: {
        backgroundColor: 'white',
        paddingTop: Platform.OS === 'android' ? 50 : 20,
        borderBottomWidth: 1,
        borderColor: '#F1F5F9'
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        height: 60
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: '#0F172A'
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center'
    },
    itemCard: {
        width: (WIDTH - 48) / 2,
        backgroundColor: 'white',
        borderRadius: 24,
        marginBottom: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#F1F5F9'
    },
    itemImage: {
        width: '100%',
        height: 160
    },
    removeBtn: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.9)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    itemInfo: {
        padding: 12
    },
    itemTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 4
    },
    itemPrice: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 12
    },
    addCartBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0F172A',
        paddingVertical: 8,
        borderRadius: 12,
        gap: 6
    },
    addCartText: {
        color: 'white',
        fontSize: 11,
        fontWeight: '800'
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center'
    },
    emptyCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    ctaBtn: {
        marginTop: 32,
        backgroundColor: '#0F172A',
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 16
    },
    ctaText: {
        color: 'white',
        fontWeight: '800',
        fontSize: 16
    }
});
