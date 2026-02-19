import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, TextInput, ScrollView, Alert, ActivityIndicator, FlatList, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { styles } from '../../styles/theme';
import { AdminAddProduct } from './AdminAddProduct';

export const AdminProducts = () => {
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
        setLoading(true);
        const { data, error } = await supabase.from('products').select('*').neq('status', 'archived').order('created_at', { ascending: false });
        if (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to fetch products');
        } else {
            setProducts(data || []);
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

    const renderItem = ({ item }) => (
        <View style={{ flexDirection: 'row', padding: 12, backgroundColor: 'white', marginBottom: 12, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 5, elevation: 1 }}>
            <Image
                source={{ uri: (item.images && item.images[0]) ? item.images[0] : 'https://placehold.co/100' }}
                style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: '#F8FAFC' }}
            />
            <View style={{ flex: 1, marginLeft: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text style={{ fontWeight: '700', color: '#0F172A', fontSize: 15, flex: 1, marginRight: 8 }} numberOfLines={1}>{item.name}</Text>
                    {item.status === 'draft' && (
                        <View style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                            <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '700' }}>DRAFT</Text>
                        </View>
                    )}
                </View>

                <Text style={{ fontSize: 15, color: '#0F172A', fontWeight: '800', marginTop: 4 }}>₦{item.price?.toLocaleString()}</Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="cube-outline" size={12} color="#64748B" />
                        <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '500' }}>{item.stock_quantity || 0} in stock</Text>
                    </View>

                    {(item.stock_quantity || 0) < 5 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF2F2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                            <Text style={{ fontSize: 10, color: '#EF4444', fontWeight: '700' }}>Low Stock</Text>
                        </View>
                    )}
                </View>
            </View>

            <View style={{ marginLeft: 8 }}>
                <TouchableOpacity onPress={() => handleEdit(item)} style={{ padding: 8, backgroundColor: '#EFF6FF', borderRadius: 8, marginBottom: 8 }}>
                    <Ionicons name="create-outline" size={18} color="#3B82F6" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id)} style={{ padding: 8, backgroundColor: '#FEF2F2', borderRadius: 8 }}>
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            {/* Header Area */}
            <View style={{ padding: 20, backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#F1F5F9', paddingBottom: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <View>
                        <Text style={styles.sectionTitle}>Products</Text>
                        <Text style={{ color: '#64748B', fontSize: 13 }}>Manage your inventory</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => setView('add')}
                        style={{ backgroundColor: '#0F172A', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6, shadowColor: '#0F172A', shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 }}
                    >
                        <Ionicons name="add" size={18} color="white" />
                        <Text style={{ color: 'white', fontWeight: '700' }}>Add New</Text>
                    </TouchableOpacity>
                </View>

                {/* Search & Filters */}
                <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 12, height: 46, borderWidth: 1, borderColor: '#E2E8F0' }}>
                        <Ionicons name="search" size={18} color="#94A3B8" />
                        <TextInput
                            placeholder="Search by name..."
                            placeholderTextColor="#94A3B8"
                            value={search}
                            onChangeText={setSearch}
                            style={{ flex: 1, marginLeft: 10, fontSize: 14, fontWeight: '500', color: '#0F172A', height: '100%' }}
                        />
                    </View>

                    <TouchableOpacity
                        onPress={() => {
                            if (stockFilter === 'all') setStockFilter('low');
                            else if (stockFilter === 'low') setStockFilter('out');
                            else setStockFilter('all');
                        }}
                        style={{
                            width: 46, height: 46,
                            backgroundColor: stockFilter === 'all' ? 'white' : '#EFF6FF',
                            borderWidth: 1,
                            borderColor: stockFilter === 'all' ? '#E2E8F0' : '#3B82F6',
                            borderRadius: 12,
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <Ionicons name="filter" size={20} color={stockFilter === 'all' ? '#64748B' : '#3B82F6'} />
                    </TouchableOpacity>
                </View>

                {stockFilter !== 'all' && (
                    <View style={{ flexDirection: 'row', marginTop: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#DBEAFE' }}>
                            <Text style={{ color: '#3B82F6', fontSize: 12, fontWeight: '600' }}>
                                Filter: {stockFilter === 'low' ? 'Low Stock' : 'Out of Stock'}
                            </Text>
                            <TouchableOpacity onPress={() => setStockFilter('all')} style={{ marginLeft: 8 }}>
                                <Ionicons name="close-circle" size={16} color="#3B82F6" />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>

            {loading && !refreshing ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color="#0F172A" />
                </View>
            ) : (
                <FlatList
                    data={filteredProducts}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProducts(); }} colors={['#0F172A']} />
                    }
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', marginTop: 60 }}>
                            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                                <Ionicons name="cube-outline" size={40} color="#94A3B8" />
                            </View>
                            <Text style={{ color: '#0F172A', fontWeight: '700', fontSize: 16 }}>No products found</Text>
                            <Text style={{ color: '#64748B', fontSize: 14, marginTop: 6, textAlign: 'center', maxWidth: 250 }}>
                                Try adjusting your search or add a new product to your inventory.
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
};
