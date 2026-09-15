import React, { useRef, useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, FlatList, Image,
    Animated, StyleSheet, Dimensions, RefreshControl, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: W } = Dimensions.get('window');

const STATUS_COLORS = {
    approved: { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' },
    draft:    { bg: '#F1F5F9', text: '#64748B', border: '#CBD5E1' },
    pending:  { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
};

const ProductCard = ({ item, onEdit, onDelete }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const stock = item.stock_quantity ?? item.stock ?? 0;
    const isOutOfStock = stock === 0;
    const isLowStock  = stock > 0 && stock <= 5;
    const statusKey   = item.status === 'approved' ? 'approved' : item.status === 'draft' ? 'draft' : 'pending';
    const sColor      = STATUS_COLORS[statusKey] || STATUS_COLORS.pending;

    const onPressIn  = () => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
    const onPressOut = () => Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true }).start();

    return (
        <Animated.View style={[SS.card, { transform: [{ scale: scaleAnim }] }]}>
            <TouchableOpacity
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                activeOpacity={1}
                style={{ flexDirection: 'row', gap: 12 }}
            >
                {/* Thumbnail */}
                <View style={SS.thumbWrap}>
                    <Image
                        source={{ uri: item.images?.[0] || item.image_url || 'https://placehold.co/80' }}
                        style={SS.thumb}
                        resizeMode="cover"
                    />
                    {isOutOfStock && (
                        <View style={SS.outBadge}>
                            <Text style={{ color: 'white', fontSize: 8, fontWeight: '900' }}>OUT</Text>
                        </View>
                    )}
                </View>

                {/* Info */}
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                        <Text style={SS.prodName} numberOfLines={2}>{item.name}</Text>
                        <View style={[SS.statusPill, { backgroundColor: sColor.bg, borderColor: sColor.border }]}>
                            <Text style={[SS.statusTxt, { color: sColor.text }]}>{statusKey}</Text>
                        </View>
                    </View>

                    <Text style={SS.priceMain}>₦{(item.price || 0).toLocaleString()}</Text>
                    {item.compare_at_price > 0 && (
                        <Text style={SS.priceOld}>₦{item.compare_at_price.toLocaleString()}</Text>
                    )}

                    {/* Stock & Category row */}
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                        <View style={[SS.infoChip, isOutOfStock && { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                            <Ionicons name="cube-outline" size={11} color={isOutOfStock ? '#EF4444' : '#64748B'} />
                            <Text style={[SS.infoChipTxt, isOutOfStock && { color: '#EF4444' }]}>
                                {stock} in stock
                            </Text>
                        </View>
                        {isLowStock && (
                            <View style={[SS.infoChip, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                                <Ionicons name="warning" size={11} color="#D9A73A" />
                                <Text style={[SS.infoChipTxt, { color: '#D9A73A' }]}>Low Stock</Text>
                            </View>
                        )}
                        {item.category ? (
                            <View style={SS.infoChip}>
                                <Ionicons name="grid-outline" size={11} color="#64748B" />
                                <Text style={SS.infoChipTxt}>{item.category}</Text>
                            </View>
                        ) : null}
                    </View>
                </View>
            </TouchableOpacity>

            {/* Action Row */}
            <View style={SS.actionRow}>
                <TouchableOpacity onPress={() => onEdit(item)} style={[SS.actionBtn, SS.editBtn]}>
                    <Ionicons name="create-outline" size={14} color="#D9A73A" />
                    <Text style={[SS.actionBtnTxt, { color: '#B45309' }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => onDelete(item.id)}
                    style={[SS.actionBtn, SS.deleteBtn]}
                >
                    <Ionicons name="trash-outline" size={14} color="#EF4444" />
                    <Text style={[SS.actionBtnTxt, { color: '#EF4444' }]}>Delete</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
};

export const VendorProducts = ({
    products = [],
    search, setSearch,
    stockFilter, setStockFilter,
    handleEditProduct,
    handleDeleteProduct,
    setViewMode,
    refreshing = false,
    setRefreshing,
    fetchDashboardData,
}) => {
    const filtered = products.filter(p => {
        const matchSearch = p.name?.toLowerCase().includes(search.toLowerCase());
        const stock = p.stock_quantity ?? p.stock ?? 0;
        if (stockFilter === 'out')  return matchSearch && stock === 0;
        if (stockFilter === 'low')  return matchSearch && stock > 0 && stock <= 5;
        return matchSearch;
    });

    const outCount = products.filter(p => (p.stock_quantity ?? p.stock ?? 0) === 0).length;
    const lowCount = products.filter(p => { const s = p.stock_quantity ?? p.stock ?? 0; return s > 0 && s <= 5; }).length;

    const FILTERS = [
        { key: 'all', label: `All (${products.length})`,   color: '#0E1A2E' },
        { key: 'low', label: `Low (${lowCount})`,          color: '#B45309' },
        { key: 'out', label: `Out (${outCount})`,          color: '#DC2626' },
    ];

    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            {/* Toolbar */}
            <View style={SS.toolbar}>
                {/* Search */}
                <View style={SS.searchBox}>
                    <Ionicons name="search" size={17} color="#94A3B8" />
                    <TextInput
                        placeholder="Search products..."
                        placeholderTextColor="#94A3B8"
                        value={search}
                        onChangeText={setSearch}
                        style={SS.searchInput}
                        returnKeyType="search"
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={() => setSearch('')}>
                            <Ionicons name="close-circle" size={17} color="#CBD5E1" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Filter pills */}
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
                    {FILTERS.map(f => {
                        const active = stockFilter === f.key;
                        return (
                            <TouchableOpacity
                                key={f.key}
                                onPress={() => setStockFilter(f.key)}
                                style={[SS.filterPill, active && { backgroundColor: f.color, borderColor: f.color }]}
                            >
                                <Text style={[SS.filterTxt, active && { color: 'white' }]}>{f.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            <FlatList
                data={filtered}
                keyExtractor={item => item.id?.toString()}
                contentContainerStyle={{ padding: 14, paddingBottom: 110 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={!!refreshing}
                        onRefresh={() => { setRefreshing?.(true); fetchDashboardData?.(); }}
                        colors={['#0E1A2E']}
                        tintColor="#0E1A2E"
                    />
                }
                renderItem={({ item }) => (
                    <ProductCard
                        item={item}
                        onEdit={handleEditProduct}
                        onDelete={handleDeleteProduct}
                    />
                )}
                ListEmptyComponent={
                    <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
                        <View style={SS.emptyIcon}>
                            <Ionicons name="cube-outline" size={44} color="#CBD5E1" />
                        </View>
                        <Text style={SS.emptyTitle}>
                            {search ? `No products matching "${search}"` : 'No products yet'}
                        </Text>
                        <Text style={SS.emptySub}>
                            {search ? 'Try a different search term.' : 'Tap the + button below to add your first product.'}
                        </Text>
                        {!search && (
                            <TouchableOpacity
                                style={SS.addFirstBtn}
                                onPress={() => setViewMode?.('add-product')}
                            >
                                <Ionicons name="add" size={18} color="white" />
                                <Text style={SS.addFirstTxt}>Add First Product</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                }
            />

            {/* FAB */}
            <TouchableOpacity
                style={SS.fab}
                onPress={() => setViewMode?.('add-product')}
                activeOpacity={0.85}
            >
                <Ionicons name="add" size={28} color="white" />
            </TouchableOpacity>
        </View>
    );
};

const SS = StyleSheet.create({
    toolbar:      { backgroundColor: 'white', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14, borderBottomWidth: 1, borderColor: '#F1F5F9' },
    searchBox:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 14, paddingHorizontal: 12, height: 44, gap: 8, borderWidth: 1, borderColor: '#E2E8F0' },
    searchInput:  { flex: 1, fontSize: 14, fontWeight: '600', color: '#0E1A2E', height: '100%' },
    filterPill:   { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: '#E2E8F0' },
    filterTxt:    { fontSize: 12, fontWeight: '700', color: '#64748B' },

    card:         { backgroundColor: 'white', borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    thumbWrap:    { width: 74, height: 74, borderRadius: 14, overflow: 'hidden', backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
    thumb:        { width: '100%', height: '100%' },
    outBadge:     { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#EF4444', alignItems: 'center', paddingVertical: 3 },
    prodName:     { fontSize: 14, fontWeight: '800', color: '#0E1A2E', flex: 1, lineHeight: 20 },
    priceMain:    { fontSize: 16, fontWeight: '900', color: '#0E1A2E', marginTop: 4, letterSpacing: -0.3 },
    priceOld:     { fontSize: 12, color: '#94A3B8', fontWeight: '600', textDecorationLine: 'line-through' },
    statusPill:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
    statusTxt:    { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
    infoChip:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
    infoChipTxt:  { fontSize: 11, fontWeight: '600', color: '#64748B' },
    actionRow:    { flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: '#F1F5F9' },
    actionBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 12, borderWidth: 1 },
    actionBtnTxt: { fontSize: 13, fontWeight: '800' },
    editBtn:      { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
    deleteBtn:    { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },

    emptyIcon:    { width: 88, height: 88, borderRadius: 44, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#E2E8F0' },
    emptyTitle:   { fontSize: 16, fontWeight: '800', color: '#0E1A2E', textAlign: 'center' },
    emptySub:     { fontSize: 13, color: '#94A3B8', textAlign: 'center', maxWidth: W * 0.7 },
    addFirstBtn:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#0E1A2E', paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14, marginTop: 6, borderWidth: 1, borderColor: '#D9A73A' },
    addFirstTxt:  { color: 'white', fontWeight: '800', fontSize: 14 },
    fab:          { position: 'absolute', bottom: 28, right: 20, width: 58, height: 58, borderRadius: 29, backgroundColor: '#0E1A2E', alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, borderWidth: 1.5, borderColor: '#D9A73A' },
});
