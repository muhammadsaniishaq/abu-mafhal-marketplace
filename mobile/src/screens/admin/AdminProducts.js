import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, TextInput, ScrollView, Alert, ActivityIndicator, FlatList, RefreshControl, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { AdminAddProduct } from './AdminAddProduct';

export const AdminProducts = ({ navigation, onBack }) => {
    // View state: 'list' or 'add'
    const [view, setView] = useState('list');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filters
    const [search, setSearch] = useState('');
    const [stockFilter, setStockFilter] = useState('all'); // 'all', 'low', 'out'

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .neq('status', 'archived')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) {
                console.error("Fetch Products Error:", error);
                Alert.alert('Error', error.message || 'Failed to fetch products');
            } else {
                setProducts(data || []);
            }
        } catch (err) {
            console.error("Fetch Products Crash:", err);
            Alert.alert('Network Error', 'Could not load products.');
        }
        setLoading(false);
        setRefreshing(false);
    };

    const handleDelete = async (id) => {
        Alert.alert('Delete Product', 'Are you sure? This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    // Soft delete: Update status to 'archived'
                    const { error } = await supabase.from('products').update({ status: 'archived' }).eq('id', id);
                    if (!error) {
                        setProducts(products.filter(p => p.id !== id));
                        Alert.alert('Success', 'Product moved to archive');
                    } else {
                        Alert.alert('Error', error.message);
                    }
                }
            }
        ]);
    };

    const handleEdit = (product) => {
        setSelectedProduct(product);
        setView('add');
    };

    // --- RENDER ADD PRODUCT SCREEN ---
    if (view === 'add') {
        return (
            <AdminAddProduct
                initialData={selectedProduct}
                onCancel={() => {
                    setView('list');
                    setSelectedProduct(null);
                }}
                onSuccess={() => {
                    setView('list');
                    setSelectedProduct(null);
                    fetchProducts();
                }}
            />
        );
    }

    // --- FILTERS LOGIC ---
    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name?.toLowerCase().includes(search.toLowerCase());
        const stock = p.stock_quantity || 0;

        let matchesStock = true;
        if (stockFilter === 'low') matchesStock = stock > 0 && stock < 10;
        if (stockFilter === 'out') matchesStock = stock === 0;

        return matchesSearch && matchesStock;
    });

    const renderItem = ({ item }) => {
        if (!item) return null;
        return (
            <View style={{ flexDirection: 'row', padding: 14, backgroundColor: '#FFFFFF', marginBottom: 12, borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 }}>
                <Image
                    source={{ uri: (item?.images && item.images[0]) ? item.images[0] : 'https://placehold.co/100' }}
                    style={{ width: 68, height: 68, borderRadius: 14, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9' }}
                />
                <View style={{ flex: 1, marginLeft: 14 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Text style={{ fontWeight: '800', color: '#0E1A2E', fontSize: 15, flex: 1, marginRight: 8 }} numberOfLines={1}>{item.name}</Text>
                        {item.status === 'draft' && (
                            <View style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '700' }}>DRAFT</Text>
                            </View>
                        )}
                    </View>

                    <Text style={{ fontSize: 15, color: '#0E1A2E', fontWeight: '900', marginTop: 4 }}>₦{item.price?.toLocaleString()}</Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8, flexWrap: 'wrap' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="cube-outline" size={12} color="#64748B" />
                            <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600' }}>{item.stock_quantity || 0} in stock</Text>
                        </View>

                        {(item.stock_quantity || 0) === 0 ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF2F2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#FECACA' }}>
                                <Text style={{ fontSize: 10, color: '#EF4444', fontWeight: '800' }}>Out of Stock</Text>
                            </View>
                        ) : (item.stock_quantity || 0) < 5 ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFBEB', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#FDE68A' }}>
                                <Text style={{ fontSize: 10, color: '#D9A73A', fontWeight: '800' }}>Low Stock</Text>
                            </View>
                        ) : null}
                    </View>
                </View>

                <View style={{ marginLeft: 8, gap: 6 }}>
                    <TouchableOpacity onPress={() => handleEdit(item)} style={{ padding: 8, backgroundColor: '#FFFBEB', borderRadius: 10, borderWidth: 1, borderColor: '#FDE68A' }}>
                        <Ionicons name="create-outline" size={18} color="#D9A73A" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item.id)} style={{ padding: 8, backgroundColor: '#FEF2F2', borderRadius: 10, borderWidth: 1, borderColor: '#FECACA' }}>
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            {/* Header Area */}
            <View style={{ paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 48 : 20, paddingBottom: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#E2E8F0' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        {(navigation?.canGoBack?.() || onBack) && (
                            <TouchableOpacity onPress={onBack || (() => navigation.goBack())} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' }}>
                                <Ionicons name="arrow-back" size={20} color="#0E1A2E" />
                            </TouchableOpacity>
                        )}
                        <View>
                            <Text style={{ fontSize: 20, fontWeight: '900', color: '#0E1A2E', letterSpacing: -0.5 }}>Product Catalog</Text>
                            <Text style={{ color: '#64748B', fontSize: 12, fontWeight: '500' }}>Manage live inventory & pricing</Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={() => setView('add')}
                        style={{ backgroundColor: '#0E1A2E', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#D9A73A', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 }}
                    >
                        <Ionicons name="add" size={18} color="#D9A73A" />
                        <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>Add New</Text>
                    </TouchableOpacity>
                </View>

                {/* Search & Filters */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: '#E2E8F0' }}>
                        <Ionicons name="search" size={18} color="#94A3B8" />
                        <TextInput
                            placeholder="Search products by name..."
                            placeholderTextColor="#94A3B8"
                            value={search}
                            onChangeText={setSearch}
                            style={{ flex: 1, marginLeft: 10, fontSize: 14, fontWeight: '600', color: '#0E1A2E', height: '100%' }}
                        />
                        {search.length > 0 && (
                            <TouchableOpacity onPress={() => setSearch('')}>
                                <Ionicons name="close-circle" size={18} color="#94A3B8" />
                            </TouchableOpacity>
                        )}
                    </View>

                    <TouchableOpacity
                        onPress={() => {
                            if (stockFilter === 'all') setStockFilter('low');
                            else if (stockFilter === 'low') setStockFilter('out');
                            else setStockFilter('all');
                        }}
                        style={{
                            width: 44, height: 44,
                            backgroundColor: stockFilter === 'all' ? '#FFFFFF' : '#0E1A2E',
                            borderWidth: 1,
                            borderColor: stockFilter === 'all' ? '#E2E8F0' : '#D9A73A',
                            borderRadius: 12,
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <Ionicons name="filter" size={18} color={stockFilter === 'all' ? '#64748B' : '#D9A73A'} />
                    </TouchableOpacity>
                </View>

                {stockFilter !== 'all' && (
                    <View style={{ flexDirection: 'row', marginTop: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: stockFilter === 'out' ? '#FEF2F2' : '#FFFBEB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: stockFilter === 'out' ? '#FECACA' : '#FDE68A' }}>
                            <Text style={{ color: stockFilter === 'out' ? '#DC2626' : '#B45309', fontSize: 12, fontWeight: '700' }}>
                                Filter: {stockFilter === 'low' ? 'Low Stock (< 10)' : 'Out of Stock (0)'}
                            </Text>
                            <TouchableOpacity onPress={() => setStockFilter('all')} style={{ marginLeft: 8 }}>
                                <Ionicons name="close-circle" size={16} color={stockFilter === 'out' ? '#DC2626' : '#B45309'} />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>

            {loading && !refreshing ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color="#0E1A2E" />
                </View>
            ) : (
                <FlatList
                    data={filteredProducts}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProducts(); }} colors={['#0E1A2E']} />
                    }
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', marginTop: 60 }}>
                            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
                                <Ionicons name="cube-outline" size={40} color="#94A3B8" />
                            </View>
                            <Text style={{ color: '#0E1A2E', fontWeight: '800', fontSize: 17 }}>No products found</Text>
                            <Text style={{ color: '#64748B', fontSize: 14, marginTop: 6, textAlign: 'center', maxWidth: 260 }}>
                                Try adjusting your search query or tap Add New to register items into inventory.
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
};
