import React from 'react';
import { View, Text, TouchableOpacity, FlatList, TextInput, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles/theme';

export const VendorProducts = ({
    products,
    search,
    setSearch,
    stockFilter,
    setStockFilter,
    handleEditProduct,
    handleDeleteProduct,
    setViewMode
}) => {

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name?.toLowerCase().includes(search.toLowerCase());
        let matchesStock = true;

        if (stockFilter === 'out') matchesStock = p.stock_quantity === 0;
        else if (stockFilter === 'low') matchesStock = p.stock_quantity > 0 && p.stock_quantity <= 5;

        return matchesSearch && matchesStock;
    });

    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <View style={{ padding: 20, backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#F1F5F9' }}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingHorizontal: 12, borderRadius: 12, height: 44 }}>
                        <Ionicons name="search" size={18} color="#64748B" />
                        <TextInput
                            placeholder="Search products..."
                            style={{ flex: 1, marginLeft: 8, fontSize: 13 }}
                            value={search}
                            onChangeText={setSearch}
                        />
                    </View>
                    <TouchableOpacity style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="options" size={20} color="#0F172A" />
                    </TouchableOpacity>
                </View>

                {/* Filters */}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <TouchableOpacity
                        onPress={() => setStockFilter('all')}
                        style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: stockFilter === 'all' ? '#0F172A' : '#F1F5F9' }}
                    >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: stockFilter === 'all' ? 'white' : '#64748B' }}>All ({products.length})</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setStockFilter('low')}
                        style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: stockFilter === 'low' ? '#0F172A' : '#F1F5F9' }}
                    >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: stockFilter === 'low' ? 'white' : '#64748B' }}>Low Stock</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setStockFilter('out')}
                        style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: stockFilter === 'out' ? '#0F172A' : '#FEE2E2' }}
                    >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: stockFilter === 'out' ? 'white' : '#EF4444' }}>Out of Stock</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <FlatList
                data={filteredProducts}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
                renderItem={({ item }) => {
                    if (!item) return null;
                    return (
                        <View style={{ flexDirection: 'row', backgroundColor: 'white', padding: 12, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9', alignItems: 'center' }}>
                            <Image source={{ uri: item?.images?.[0] }} style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: '#F1F5F9' }} />

                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }} numberOfLines={1}>{item.name}</Text>
                                <Text style={{ fontSize: 13, fontWeight: '800', color: '#10B981', marginTop: 2 }}>₦{item.price?.toLocaleString()}</Text>

                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 12 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons name="cube-outline" size={12} color="#64748B" />
                                        <Text style={{ fontSize: 11, color: '#64748B', marginLeft: 4 }}>{item.stock_quantity} left</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons name="eye-outline" size={12} color="#64748B" />
                                        <Text style={{ fontSize: 11, color: '#64748B', marginLeft: 4 }}>0 views</Text>
                                    </View>
                                </View>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TouchableOpacity onPress={() => handleEditProduct(item)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name="pencil" size={16} color="#0F172A" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDeleteProduct(item.id)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name="trash" size={16} color="#EF4444" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    );
                }}
                ListEmptyComponent={
                    <View style={{ alignItems: 'center', padding: 40 }}>
                        <Ionicons name="cube-outline" size={48} color="#CBD5E1" />
                        <Text style={{ color: '#94A3B8', marginTop: 16 }}>No products found.</Text>
                        <TouchableOpacity style={[styles.modernBtn, { marginTop: 24 }]} onPress={() => setViewMode('add-product')}>
                            <Text style={styles.modernBtnText}>Add First Product</Text>
                        </TouchableOpacity>
                    </View>
                }
            />

            {/* Floating FAB */}
            <TouchableOpacity
                style={{ position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', boxShadow: '0px 8px 16px rgba(15,23,42,0.3)', elevation: 5 }}
                onPress={() => setViewMode('add-product')}
            >
                <Ionicons name="add" size={28} color="white" />
            </TouchableOpacity>
        </View>
    );
};
